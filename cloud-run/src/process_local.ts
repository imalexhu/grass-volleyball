/**
 * process_local.ts — Run the full processing pipeline against a local video file.
 *
 * Skips Firebase Storage download entirely. Point it at a video on disk,
 * attach a Firestore match ID, and it will:
 *   1. Fetch match events from Firestore
 *   2. Trim all rallies → trimmed.mp4  (score overlay via drawtext)
 *   3. Upload trimmed.mp4 to YouTube (unlisted)
 *   4. Extract highlight rallies → highlights.mp4
 *   5. Upload highlights.mp4 to YouTube (unlisted)
 *   6. Write YouTube URLs back to the Firestore match document
 *
 * Requirements:
 *   ffmpeg with libfreetype (drawtext support):
 *     brew tap homebrew-ffmpeg/ffmpeg
 *     brew install homebrew-ffmpeg/ffmpeg/ffmpeg
 *
 * Usage (from cloud-run/ directory):
 *   npm run process-local -- \
 *     --matchId  <firestoreMatchId> \
 *     --perspective A \
 *     --videoPath "/path/to/your/video.mov"
 */

import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";

const execAsync = promisify(exec);

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

const matchId     = getArg("matchId");
const perspective = getArg("perspective") as "A" | "B";
const videoPath   = getArg("videoPath");

if (!["A", "B"].includes(perspective)) {
  console.error('❌ --perspective must be "A" or "B"');
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error(`❌ Video file not found: "${videoPath}"`);
  process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchEvent {
  id: string;
  type: "serve" | "point" | "set-finish";
  team?: "A" | "B";
  timestamp: number;
  scoreA: number;
  scoreB: number;
  isHighlight?: boolean;
}

interface Rally {
  serve: MatchEvent;
  point: MatchEvent;
  startSec: number;   // relative to firstServe
  endSec: number;     // relative to firstServe
}

// ─── Firebase init ────────────────────────────────────────────────────────────

function initFirebase() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!b64 || b64 === "<paste-base64-output-here>") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in cloud-run/.env");
  }
  const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const app = initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

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

async function uploadToYouTube(filePath: string, title: string, description: string): Promise<string> {
  const youtube = getYouTube();
  const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
  console.log(`\n[YouTube] Uploading "${title}" (${sizeMB} MB)…`);
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description, tags: ["volleyball", "grass volleyball"], categoryId: "17" },
      status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(filePath) },
  });
  const videoId = res.data.id;
  if (!videoId) throw new Error("YouTube returned no video ID");
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[YouTube] ✅ ${url}`);
  return url;
}

// ─── FFmpeg helpers ───────────────────────────────────────────────────────────

/**
 * Extract rallies from events.
 * Timing: start = serve timestamp (0s buffer), end = point timestamp + 1s
 */
function extractRallies(
  events: MatchEvent[],
  highlightOnly = false
): Rally[] {
  const firstServe = events.find(e => e.type === "serve");
  if (!firstServe) return [];

  const rallies: Rally[] = [];
  let currentServe: MatchEvent | null = null;

  for (const event of events) {
    if (event.type === "serve") {
      currentServe = event;
    } else if (event.type === "point" && currentServe) {
      if (!highlightOnly || event.isHighlight) {
        // 0s buffer before serve, 1s buffer after point
        let startSec = (currentServe.timestamp - firstServe.timestamp) / 1000;
        if (startSec < 0) startSec = 0;
        const endSec = (event.timestamp - firstServe.timestamp) / 1000 + 1;
        rallies.push({ serve: currentServe, point: event, startSec, endSec });
      }
      currentServe = null;
    }
  }

  return rallies;
}

/**
 * Build ffmpeg command using the concat FILTER (not demuxer).
 * Each segment is a separate -i input with -ss/-to, then joined via concat filter.
 * This avoids timestamp discontinuities that cause choppy playback.
 *
 * Score overlay via drawtext (requires ffmpeg built with libfreetype —
 * install via: brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg)
 */
function buildConcatFilterCmd(
  rallies: Rally[],
  rawVideoPath: string,
  outputPath: string,
  withScoreOverlay: boolean
): string {
  if (rallies.length === 0) throw new Error("No rallies to encode");

  const n = rallies.length;

  // Each rally = one input with precise seek
  const inputs = rallies.map(r =>
    `-ss ${r.startSec.toFixed(3)} -to ${r.endSec.toFixed(3)} -i "${rawVideoPath}"`
  ).join(" ");

  // Build filter_complex
  const filterParts: string[] = [];

  if (withScoreOverlay) {
    // Apply drawtext score overlay to each segment, then concat
    rallies.forEach((r, i) => {
      const score = `${r.point.scoreA} - ${r.point.scoreB}`;
      // Escape colons and backslashes for drawtext
      const safeScore = score.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
      filterParts.push(
        `[${i}:v]drawtext=text='${safeScore}':` +
        `fontsize=72:fontcolor=white:` +
        `box=1:boxcolor=black@0.65:boxborderw=20:` +
        `x=(w-text_w)/2:y=60[v${i}]`
      );
    });
    // Concat all labeled video + audio streams
    const concatInputs = rallies.map((_, i) => `[v${i}][${i}:a]`).join("");
    filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=1[outv][outa]`);
  } else {
    // No overlay — just concat
    const concatInputs = rallies.map((_, i) => `[${i}:v][${i}:a]`).join("");
    filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=1[outv][outa]`);
  }

  const filterComplex = filterParts.join(";");

  return [
    "ffmpeg -y",
    inputs,
    `-filter_complex "${filterComplex}"`,
    `-map "[outv]" -map "[outa]"`,
    `-c:v libx264 -preset fast -crf 22`,
    `-c:a aac -b:a 128k`,
    `"${outputPath}"`,
  ].join(" ");
}

async function runFFmpeg(cmd: string) {
  console.log(`\n[FFmpeg] ${cmd}\n`);
  try {
    const { stderr } = await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024 });
    if (stderr) console.log("[FFmpeg]", stderr.split("\n").slice(-3).join("\n"));
  } catch (err: any) {
    const detail = err.stderr ? `\n${err.stderr.split("\n").slice(-15).join("\n")}` : "";
    throw new Error(`FFmpeg failed:${detail}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎬 Local Video Processor");
  console.log(`   Match ID:    ${matchId}`);
  console.log(`   Perspective: ${perspective}`);
  console.log(`   Video:       ${videoPath}`);

  const db = initFirebase();

  // 1. Fetch match from Firestore
  console.log("\n[Firestore] Fetching match events…");
  const matchSnap = await db.collection("matches").doc(matchId).get();
  if (!matchSnap.exists) throw new Error(`Match "${matchId}" not found in Firestore`);

  const matchData = matchSnap.data()!;
  const events: MatchEvent[] = (matchData.events || []) as MatchEvent[];
  const teamA: string = matchData.teamA;
  const teamB: string = matchData.teamB;

  console.log(`[Firestore] ${events.length} events — ${teamA} vs ${teamB}`);

  if (events.length === 0) throw new Error("Match has no recorded events");

  const allRallies       = extractRallies(events, false);
  const highlightRallies = extractRallies(events, true);

  console.log(`            ${allRallies.length} rallies, ${highlightRallies.length} highlights`);

  if (allRallies.length === 0) throw new Error("Could not extract any rally segments from events");

  // 2. Detect if drawtext is available (libfreetype)
  let hasDrawtext = false;
  try {
    await execAsync("ffmpeg -filters 2>&1 | grep -q drawtext");
    hasDrawtext = true;
  } catch {
    console.warn("[FFmpeg] ⚠️  drawtext not available — score overlay will be skipped.");
    console.warn("         Install: brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg");
  }

  // 3. Set up temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `local_process_`));
  console.log(`\n[Tmp] Working in ${tmpDir}`);

  try {
    // 4. Trimmed video (all rallies + score overlay)
    console.log(`\n[FFmpeg] Building trimmed video (${allRallies.length} rallies, overlay=${hasDrawtext})…`);
    const trimmedPath = path.join(tmpDir, "trimmed.mp4");
    const trimCmd = buildConcatFilterCmd(allRallies, videoPath, trimmedPath, hasDrawtext);
    await runFFmpeg(trimCmd);
    console.log(`[FFmpeg] ✅ Trimmed video: ${trimmedPath}`);

    // 5. Upload trimmed to YouTube
    const trimmedUrl = await uploadToYouTube(
      trimmedPath,
      `[Trimmed] ${teamA} vs ${teamB} — Perspective ${perspective}`,
      `Full match VOD with all rallies trimmed. Perspective ${perspective}.`
    );
    await db.collection("matches").doc(matchId).set(
      { [`vodUrl${perspective}`]: trimmedUrl },
      { merge: true }
    );
    console.log(`[Firestore] vodUrl${perspective} saved`);

    // 6. Highlights video
    let highlightsUrl: string | null = null;
    if (highlightRallies.length > 0) {
      console.log(`\n[FFmpeg] Building highlights video (${highlightRallies.length} rallies)…`);
      const hlPath = path.join(tmpDir, "highlights.mp4");
      const hlCmd = buildConcatFilterCmd(highlightRallies, videoPath, hlPath, hasDrawtext);
      await runFFmpeg(hlCmd);
      console.log(`[FFmpeg] ✅ Highlights video: ${hlPath}`);

      highlightsUrl = await uploadToYouTube(
        hlPath,
        `[Highlights] ${teamA} vs ${teamB} — Perspective ${perspective}`,
        `Best rallies from the match. Perspective ${perspective}.`
      );
      await db.collection("matches").doc(matchId).set(
        { matchHighlightsUrl: highlightsUrl },
        { merge: true }
      );
      console.log("[Firestore] matchHighlightsUrl saved");
    } else {
      console.log("\n[Highlights] No highlights marked — skipping.");
    }

    // 7. Summary
    console.log("\n✅ Processing complete!\n");
    console.log(`   Trimmed VOD:  ${trimmedUrl}`);
    if (highlightsUrl) console.log(`   Highlights:   ${highlightsUrl}`);
    console.log();

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("\n❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
