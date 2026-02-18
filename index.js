require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');

// --- Configuration ---
const TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_PORT = process.env.PORT || 3000;
const WEBHOOK_IP = process.env.IP || '0.0.0.0'; // Bind to IP if provided by host (Alwaysdata)
const WEBHOOK_AUTH = process.env.WEBHOOK_AUTH; // Optional: verify webhook secret if supported
const ROLE_ID = '1473432505897062521'; // The role to give
const VOTE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

// --- Database Setup ---
const db = new Database('votes.db');
db.prepare(`
  CREATE TABLE IF NOT EXISTS votes (
    user_id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  )
`).run();

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel] // Required for DMs
});

// --- Express Server Setup ---
const app = express();
app.use(bodyParser.json());

// --- Helper Functions ---

// Add or update vote in database
function updateVote(userId) {
  const expiresAt = Date.now() + VOTE_DURATION_MS;
  const stmt = db.prepare(`
    INSERT INTO votes (user_id, expires_at)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET expires_at = excluded.expires_at
  `);
  stmt.run(userId, expiresAt);
  return expiresAt;
}

// Remove vote from database
function removeVote(userId) {
  const stmt = db.prepare('DELETE FROM votes WHERE user_id = ?');
  stmt.run(userId);
}

// Get all expired votes
function getExpiredVotes() {
  const now = Date.now();
  const stmt = db.prepare('SELECT user_id FROM votes WHERE expires_at <= ?');
  return stmt.all(now);
}

// --- Webhook Route ---
app.post('/webhook', async (req, res) => {
  // Log the request for debugging
  console.log('Received webhook:', req.body);

  // Check authorization if set
  if (WEBHOOK_AUTH && req.headers.authorization !== WEBHOOK_AUTH) {
    console.log('Unauthorized webhook attempt');
    return res.status(401).send('Unauthorized');
  }

  // Extract user ID from payload
  // discordbotlist.com payload usually has { id: "USER_ID", ... }
  // Adjust based on actual payload structure if different
  const userId = req.body.id || req.body.user?.id; 

  if (!userId) {
    console.log('No user ID found in webhook payload');
    return res.status(400).send('User ID missing');
  }
  
  try {
    // 1. Update Database
    updateVote(userId);
    console.log(`Vote registered for user ${userId}`);

    // 2. Add Role & Send DM
    // Find the guild that has the configured role
    const guild = client.guilds.cache.find(g => g.roles.cache.has(ROLE_ID));
    
    if (guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const role = guild.roles.cache.get(ROLE_ID);
          if (role) {
            await member.roles.add(role);
            console.log(`Added role to ${member.user.tag} in ${guild.name}`);
            
            // Send DM
            try {
              await member.send(
                "You have succesfully voted! Therefore you getting the role **Server Voter** for 1 week then you have to upvote again to refresh the timer**"
              );
            } catch (dmError) {
              console.error(`Could not DM user ${userId}:`, dmError);
            }
          }
        } else {
           console.log(`User ${userId} not found in guild ${guild.name}`);
        }
      } catch (err) {
        console.error(`Error processing guild ${guild.name}:`, err);
      }
    } else {
      console.log(`Guild with role ID ${ROLE_ID} not found in cache.`);
    }

    res.status(200).send('Vote processed');
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).send('Internal Server Error');
  }
});

// --- Expiration Checker ---
let isChecking = false;
setInterval(async () => {
  if (isChecking) return;
  isChecking = true;
  
  try {
    const expiredVotes = getExpiredVotes();
    
    if (expiredVotes.length > 0) {
        console.log(`Found ${expiredVotes.length} expired votes.`);
        
        // Find the guild that has the configured role
        const guild = client.guilds.cache.find(g => g.roles.cache.has(ROLE_ID));
        
        for (const vote of expiredVotes) {
          const userId = vote.user_id;
          
          if (guild) {
            try {
              const member = await guild.members.fetch(userId).catch(() => null);
              if (member) {
                const role = guild.roles.cache.get(ROLE_ID);
                if (role && member.roles.cache.has(ROLE_ID)) {
                  await member.roles.remove(role);
                  console.log(`Removed role from ${member.user.tag} in ${guild.name}`);

                  // Send DM
                  try {
                    await member.send("**Your role got removed please upvote again**");
                  } catch (dmError) {
                    console.error(`Could not DM user ${userId}:`, dmError);
                  }
                }
              }
            } catch (err) {
              console.error(`Error processing expiration for user ${userId}:`, err);
            }
          }

          // Remove from DB regardless of whether they are in the guild
          removeVote(userId);
        }
    }
  } catch (error) {
    console.error('Error in expiration checker:', error);
  } finally {
    isChecking = false;
  }
}, 60 * 1000); // Check every minute

// --- Start ---
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  app.listen(WEBHOOK_PORT, WEBHOOK_IP, () => {
    console.log(`Webhook server listening on ${WEBHOOK_IP}:${WEBHOOK_PORT}`);
  });
});

client.login(TOKEN);
