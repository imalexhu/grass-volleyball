/**
 * youtube_cleanup.ts — Delete YouTube videos linked to a Firestore match.
 *
 * Reads vodUrlA, vodUrlB, and matchHighlightsUrl from the match document,
 * deletes those videos from YouTube, then clears the URL fields in Firestore.
 *
 * Usage (from cloud-run/ directory):
 *   npm run youtube-cleanup -- --matchId <firestoreMatchId>
 *
 * Optional flags:
 *   --dry-run    Print what would be deleted without actually deleting
 */

import path from "path";
import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";

// ─── Load .env ────────────────────────────────────────────────────────────────

for (const envFile of [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
]) {
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    break;
  }
}

// ─── Args ─────────────────────────────────────────────────────────────────────

function getArg(name: string, required = true): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) {
    if (required) { console.error(`❌ Missing --${name}`); process.exit(1); }
    return "";
  }
  const parts: string[] = [];
  for (let i = idx + 1; i < process.argv.length; i++) {
    if (process.argv[i].startsWith("--")) break;
    parts.push(process.argv[i]);
  }
  return parts.join(" ");
}

const matchId = getArg("matchId");
const dryRun  = process.argv.includes("--dry-run");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function initFirebase() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!b64 || b64 === "<paste-base64-output-here>") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in cloud-run/.env");
  }
  const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const app = initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

function getYouTube() {
  const clientId     = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN");
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: "v3", auth });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🧹 YouTube Cleanup${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Match ID: ${matchId}\n`);

  const db      = initFirebase();
  const youtube = getYouTube();

  // 1. Fetch match document
  const matchSnap = await db.collection("matches").doc(matchId).get();
  if (!matchSnap.exists) throw new Error(`Match "${matchId}" not found in Firestore`);

  const data = matchSnap.data()!;

  // 2. Collect all YouTube URLs stored on the match
  const urlFields: Record<string, string> = {};
  for (const field of ["vodUrlA", "vodUrlB", "matchHighlightsUrl"]) {
    if (data[field]) urlFields[field] = data[field] as string;
  }

  if (Object.keys(urlFields).length === 0) {
    console.log("ℹ️  No YouTube URLs found on this match. Nothing to delete.");
    return;
  }

  // 3. Delete each video
  const fieldsToClear: Record<string, any> = {};

  for (const [field, url] of Object.entries(urlFields)) {
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.warn(`⚠️  Could not extract video ID from ${field}: ${url}`);
      continue;
    }

    console.log(`🎬 ${field}: https://www.youtube.com/watch?v=${videoId}`);

    if (dryRun) {
      console.log(`   → [dry-run] Would delete video ${videoId}`);
    } else {
      try {
        await youtube.videos.delete({ id: videoId });
        console.log(`   ✅ Deleted`);
        fieldsToClear[field] = null; // will remove from Firestore
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message ?? err?.message ?? String(err);
        console.error(`   ❌ Failed to delete: ${msg}`);
      }
    }
  }

  // 4. Clear deleted URL fields from Firestore
  if (!dryRun && Object.keys(fieldsToClear).length > 0) {
    // Firestore doesn't support null to delete a field — use FieldValue.delete()
    const { FieldValue } = await import("firebase-admin/firestore");
    const updates: Record<string, any> = {};
    for (const field of Object.keys(fieldsToClear)) {
      updates[field] = FieldValue.delete();
    }
    await db.collection("matches").doc(matchId).update(updates);
    console.log(`\n[Firestore] Cleared fields: ${Object.keys(fieldsToClear).join(", ")}`);
  }

  console.log(`\n${dryRun ? "✅ Dry run complete." : "✅ Cleanup complete."}\n`);
}

main().catch((err) => {
  console.error("\n❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
