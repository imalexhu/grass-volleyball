/**
 * Test script to verify YouTube upload works.
 *
 * Usage:
 *   npx tsx scripts/test_youtube_upload.ts path/to/video.mp4
 *
 * Prerequisites:
 *   - All YOUTUBE_* env vars must be set in .env (including YOUTUBE_REFRESH_TOKEN)
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Load .env manually
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const videoPath = process.argv[2];

if (!videoPath) {
  console.error("Usage: npx tsx scripts/test_youtube_upload.ts <path-to-video.mp4>");
  process.exit(1);
}

const absolutePath = path.resolve(videoPath);

if (!fs.existsSync(absolutePath)) {
  console.error(`❌ File not found: ${absolutePath}`);
  process.exit(1);
}

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("❌ Missing YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, or YOUTUBE_REFRESH_TOKEN in .env");
  console.error("   Run `npx tsx scripts/youtube_auth.ts` first to get a refresh token.");
  process.exit(1);
}

import cliProgress from "cli-progress";

async function main() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  const fileSize = fs.statSync(absolutePath).size;
  const fileName = path.basename(absolutePath, path.extname(absolutePath));

  console.log(`\n🏐 YouTube Upload Test`);
  console.log(`   File: ${absolutePath}`);
  console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(1)} MB\n`);

  // Initialize progress bar with MB formatting
  const progressBar = new cliProgress.SingleBar({
    format: "Uploading | {bar} | {percentage}% | {mbProgress} | ETA: {eta}s",
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  progressBar.start(fileSize, 0, { mbProgress: "0/0 MB" });

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: `[Test] ${fileName}`,
        description: "Test upload from Grass Volleyball app",
        tags: ["volleyball", "grass volleyball", "test"],
        categoryId: "17", // Sports
      },
      status: {
        privacyStatus: "private", // Use private for test uploads
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(absolutePath),
    },
  }, {
    // Resumable uploads are handled automatically by the library when using streams,
    // but we ensure progress is tracked correctly in MB for the user.
    onUploadProgress: (evt) => {
      const mbRead = (evt.bytesRead / 1024 / 1024).toFixed(1);
      const mbTotal = (fileSize / 1024 / 1024).toFixed(1);
      progressBar.update(evt.bytesRead, { 
        mbProgress: `${mbRead}/${mbTotal} MB` 
      });
    },
  });

  progressBar.stop();

  const videoId = response.data.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`\n✅ Upload successful!`);
  console.log(`   Video ID: ${videoId}`);
  console.log(`   URL: ${url}\n`);
}

main().catch((err) => {
  console.error("\n❌ Upload failed:", err.message || err);
  if (err.response?.data) {
    console.error("   API Error:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
