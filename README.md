# Discord Vote Webhook Bot

This bot listens for upvotes from `discordbotlist.com`, assigns a role for 1 week, and handles expiration notifications.

## Features
- **Webhook Listener**: Receives vote events.
- **Role Management**: Adds "Server Voter" role for 7 days.
- **Expiration Handling**: Automatically removes the role after 7 days and DMs the user.
- **Renewal**: Resets the timer if the user votes again before expiration.

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configuration**
    Copy `.env.example` to `.env` and fill in the details:
    ```bash
    cp .env.example .env
    ```
    - `DISCORD_TOKEN`: Your Bot Token from the Discord Developer Portal.
    - `PORT`: The port for the webhook server (default 3000).
    - `WEBHOOK_AUTH`: (Optional) A secret string to secure your webhook. You set this same string in the `Authorization` field on discordbotlist.com.

3.  **Run the Bot**
    ```bash
    node index.js
    ```

## Webhook URL for discordbotlist.com

To connect your bot to `discordbotlist.com`, you need a public URL.

### Option A: Hosting on a VPS/Server
If you are hosting this on a server with a public IP (e.g., DigitalOcean, AWS):
- **URL**: `http://YOUR_SERVER_IP:3000/webhook`

### Option B: Running Locally (Testing)
If you are running this on your own computer, you need to expose your local port 3000 to the internet.

1.  I have installed `ngrok` locally for you.
2.  Run this command in your terminal:
    ```bash
    npx ngrok http 3000
    ```
3.  Copy the `https` URL provided (e.g., `https://a1b2c3d4.ngrok.io`).
4.  Append `/webhook` to it.
    - **URL**: `https://a1b2c3d4.ngrok.io/webhook`

**Note:** If ngrok asks for an authentication token, sign up at [ngrok.com](https://dashboard.ngrok.com/signup), get your token, and run:
```bash
npx ngrok authtoken YOUR_TOKEN_HERE
```
1.  Go to your bot's page on `discordbotlist.com`.
2.  Go to **Edit** -> **Webhooks**.
3.  Paste the **URL** (from Option A or B) into the Webhook URL field.
4.  (Optional) Enter the `WEBHOOK_AUTH` secret in the Authorization/Secret field if you set one in `.env`.

## Database
The bot uses a local SQLite database (`votes.db`) to track expiration times. This file will be created automatically.
