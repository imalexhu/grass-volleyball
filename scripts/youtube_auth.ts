/**
 * One-time script to obtain a YouTube OAuth2 refresh token.
 *
 * Usage:
 *   npx tsx scripts/youtube_auth.ts
 *
 * Prerequisites:
 *   - YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env
 *
 * This opens a browser for Google consent, then prints the refresh token
 * to paste into your .env as YOUTUBE_REFRESH_TOKEN.
 */

import { google } from "googleapis";
import http from "http";
import { URL } from "url";
import open from "open";
import fs from "fs";
import path from "path";

// Load .env manually (no dotenv dependency needed — just parse it)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const PORT = 3456; // Temporary local server for the callback
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env");
  console.error("   Please complete Steps 1–5 of the setup guide first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // Force consent to ensure we get a refresh_token
  scope: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
  ],
});

console.log("\n🏐 YouTube OAuth Setup for Grass Volleyball\n");
console.log("Opening browser for authorization...\n");

// Start a temporary local HTTP server to capture the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h1>❌ Authorization denied</h1><p>Error: ${error}</p><p>You can close this tab.</p>`);
      console.error(`\n❌ Authorization denied: ${error}`);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>❌ No authorization code received</h1>");
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center; background: #0a0a0a; color: #fafafa;">
            <h1 style="color: #22c55e;">✅ Authorization successful!</h1>
            <p>You can close this tab and return to the terminal.</p>
          </body>
        </html>
      `);

      console.log("\n✅ Authorization successful!\n");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Add this to your .env file:\n");
      console.log(`YOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"`);
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      if (!tokens.refresh_token) {
        console.warn("⚠️  No refresh_token returned. This can happen if you've already authorized.");
        console.warn("   Go to https://myaccount.google.com/permissions and revoke access,");
        console.warn("   then run this script again.\n");
      }

      server.close();
      process.exit(0);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>❌ Token exchange failed</h1><pre>${err}</pre>`);
      console.error("\n❌ Token exchange failed:", err);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(PORT, () => {
  // Open the browser to the authorization URL
  open(authUrl).catch(() => {
    console.log("Could not open browser automatically. Please visit this URL:\n");
    console.log(authUrl);
    console.log();
  });
});
