/**
 * Grass Volleyball — Cloud Run Video Processor
 *
 * Receives POST /process  { jobId, matchId, perspective, rawStoragePath }
 * Pipeline:
 *   1. Download raw video from Firebase Storage → /tmp/{jobId}/raw.mp4
 *   2. Fetch match events from Firestore
 *   3. Build FFmpeg concat + filtergraph for ALL rallies  → trimmed.mp4
 *   4. Upload trimmed.mp4 to YouTube (unlisted)
 *   5. Build FFmpeg concat + filtergraph for HIGHLIGHT rallies → highlights.mp4
 *   6. Upload highlights.mp4 to YouTube (unlisted)
 *   7. Update Firestore job + match documents
 *   8. Clean up /tmp
 *
 * Environment variables required:
 *   FIREBASE_SERVICE_ACCOUNT   Base64-encoded service account JSON
 *   FIREBASE_STORAGE_BUCKET    e.g. "my-project.appspot.com"
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 *   PORT                       (optional, default 8080)
 */

import express, { Request, Response } from "express";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";
import { google, youtube_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Startup env check (warn, don't crash) ────────────────────────────────────

function checkEnv() {
  const required = [
    "FIREBASE_STORAGE_BUCKET",
    "YOUTUBE_CLIENT_ID",
    "YOUTUBE_CLIENT_SECRET",
    "YOUTUBE_REFRESH_TOKEN",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`⚠️  Missing env vars: ${missing.join(", ")}`);
    console.warn("   Server will start but /process requests will fail until these are set.");
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT not set — will use Application Default Credentials.");
  }
}

// ─── Firebase Admin — lazy singleton ─────────────────────────────────────────

let _db: ReturnType<typeof getFirestore> | null = null;
let _storage: ReturnType<typeof getStorage> | null = null;

function getFirebaseClients() {
  if (_db && _storage) return { db: _db, storage: _storage };

  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error("FIREBASE_STORAGE_BUCKET env var is required");

  let app: App;
  if (serviceAccountB64 && serviceAccountB64 !== "<paste-base64-output-here>") {
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountB64, "base64").toString("utf8"));
    app = initializeApp({ credential: cert(serviceAccount), storageBucket: bucket });
  } else {
    // Use Application Default Credentials (automatic in Cloud Run)
    console.log("[Firebase] Using Application Default Credentials");
    app = initializeApp({ storageBucket: bucket });
  }

  _db = getFirestore(app);
  _storage = getStorage(app);
  return { db: _db, storage: _storage };
}

// ─── YouTube client ──────────────────────────────────────────────────────────

function getYouTubeClient(): youtube_v3.Youtube {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN");
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: "v3", auth });
}

// ─── Types ───────────────────────────────────────────────────────────────────

type VideoProcessingStatus =
  | "queued" | "downloading" | "trimming" | "uploading_trimmed"
  | "creating_highlights" | "uploading_highlights" | "complete" | "error";

interface MatchEvent {
  id: string;
  type: "serve" | "point" | "set-finish";
  team?: "A" | "B";
  timestamp: number;
  scoreA: number;
  scoreB: number;
  isHighlight?: boolean;
  setIndex?: number;
}

interface ProcessRequest {
  jobId: string;
  matchId: string;
  perspective: "A" | "B";
  rawStoragePath: string;
}

// ─── Firestore helpers ───────────────────────────────────────────────────────

async function updateJob(jobId: string, data: Record<string, unknown>) {
  const { db } = getFirebaseClients();
  await db.collection("processingJobs").doc(jobId).set(
    { ...data, updatedAt: Date.now() },
    { merge: true }
  );
}

async function updateMatchJob(matchId: string, data: Record<string, unknown>) {
  const { db } = getFirebaseClients();
  await db.collection("matches").doc(matchId).set(
    { processingJob: data },
    { merge: true }
  );
}

// ─── FFmpeg helpers ──────────────────────────────────────────────────────────

interface RallySegment {
  serve: MatchEvent;
  point: MatchEvent;
}

/**
 * Given match events, return rallies (serve→point pairs).
 * If highlightOnly=true, only include rallies where the point is a highlight.
 */
function extractRallies(events: MatchEvent[], highlightOnly = false): RallySegment[] {
  const rallies: RallySegment[] = [];
  let currentServe: MatchEvent | null = null;

  for (const event of events) {
    if (event.type === "serve") {
      currentServe = event;
    } else if (event.type === "point" && currentServe) {
      if (!highlightOnly || event.isHighlight) {
        rallies.push({ serve: currentServe, point: event });
      }
      currentServe = null;
    }
  }
  return rallies;
}

/**
 * Build FFmpeg concat_list and filtergraph for a set of rally segments.
 * rawVideoPath must be an absolute path.
 */
function buildFFmpegInputs(
  rallies: RallySegment[],
  rawVideoPath: string,
  firstServeTimestamp: number
): { concatList: string; filterGraph: string } {
  let concatList = "";
  const drawtextParts: string[] = [];
  let currentFinalTime = 0;

  for (const rally of rallies) {
    let startSec = (rally.serve.timestamp - firstServeTimestamp) / 1000 - 2;
    if (startSec < 0) startSec = 0;
    const endSec = (rally.point.timestamp - firstServeTimestamp) / 1000 + 2;
    const duration = endSec - startSec;

    // Escape single quotes in path (defensive)
    const escapedPath = rawVideoPath.replace(/'/g, "'\\''");
    concatList += `file '${escapedPath}'\n`;
    concatList += `inpoint ${startSec.toFixed(3)}\n`;
    concatList += `outpoint ${endSec.toFixed(3)}\n`;

    const scoreText = `${rally.point.scoreA} - ${rally.point.scoreB}`;
    const enableStr = `between(t,${currentFinalTime.toFixed(3)},${(currentFinalTime + duration).toFixed(3)})`;
    drawtextParts.push(
      `drawtext=text='${scoreText}':fontsize=72:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=15:x=(w-text_w)/2:y=100:enable='${enableStr}'`
    );

    currentFinalTime += duration;
  }

  const filterGraph = `[0:v]${drawtextParts.join(",")}[outv]`;
  return { concatList, filterGraph };
}

async function runFFmpeg(
  concatListPath: string,
  filterGraphPath: string,
  outputPath: string
): Promise<void> {
  const cmd = [
    "ffmpeg -y",
    `-f concat -safe 0 -i "${concatListPath}"`,
    `-filter_complex_script "${filterGraphPath}"`,
    `-map "[outv]" -map 0:a`,
    `-c:v libx264 -preset fast -crf 22`,
    `-c:a aac -b:a 128k`,
    `"${outputPath}"`,
  ].join(" ");

  console.log("[FFmpeg] Running:", cmd);
  const { stdout, stderr } = await execAsync(cmd);
  if (stdout) console.log("[FFmpeg stdout]", stdout);
  if (stderr) console.log("[FFmpeg stderr]", stderr);
}

// ─── YouTube upload ──────────────────────────────────────────────────────────

async function uploadToYouTube(
  filePath: string,
  title: string,
  description: string
): Promise<string> {
  const youtube = getYouTubeClient();
  const fileSize = fs.statSync(filePath).size;
  console.log(`[YouTube] Uploading "${title}" (${(fileSize / 1024 / 1024).toFixed(1)} MB)…`);

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags: ["volleyball", "grass volleyball", "highlights"],
        categoryId: "17",
      },
      status: {
        privacyStatus: "unlisted",
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(filePath),
    },
  });

  const videoId = response.data.id;
  if (!videoId) throw new Error("YouTube returned no video ID");
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[YouTube] ✅ Uploaded: ${url}`);
  return url;
}

// ─── Core pipeline ───────────────────────────────────────────────────────────

async function runPipeline(req: ProcessRequest): Promise<void> {
  const { jobId, matchId, perspective, rawStoragePath } = req;
  const tmpDir = `/tmp/${jobId}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const jobBase = { id: jobId, matchId, perspective, rawStoragePath };

  const { db, storage } = getFirebaseClients();

  try {
    // ── 1. Download raw video ─────────────────────────────────────────────
    await updateJob(jobId, { status: "downloading", progress: 5 });
    await updateMatchJob(matchId, { ...jobBase, status: "downloading", progress: 5 });

    const rawPath = path.join(tmpDir, "raw.mp4");
    console.log(`[Pipeline] Downloading ${rawStoragePath} → ${rawPath}`);
    await storage.bucket().file(rawStoragePath).download({ destination: rawPath });
    console.log("[Pipeline] Download complete");

    // ── 2. Fetch match events from Firestore ──────────────────────────────
    const matchSnap = await db.collection("matches").doc(matchId).get();
    if (!matchSnap.exists) throw new Error(`Match ${matchId} not found`);
    const events: MatchEvent[] = (matchSnap.data()?.events || []) as MatchEvent[];

    if (events.length === 0) throw new Error("Match has no recorded events");

    const firstServe = events.find(e => e.type === "serve");
    if (!firstServe) throw new Error("No serve event found — cannot compute timestamps");

    // ── 3. Trim all rallies ───────────────────────────────────────────────
    await updateJob(jobId, { status: "trimming", progress: 20 });
    await updateMatchJob(matchId, { ...jobBase, status: "trimming", progress: 20 });

    const allRallies = extractRallies(events);
    console.log(`[Pipeline] ${allRallies.length} rallies found`);

    const { concatList, filterGraph } = buildFFmpegInputs(allRallies, rawPath, firstServe.timestamp);
    const concatListPath = path.join(tmpDir, "concat_all.txt");
    const filterGraphPath = path.join(tmpDir, "filtergraph_all.txt");
    fs.writeFileSync(concatListPath, concatList);
    fs.writeFileSync(filterGraphPath, filterGraph);

    const trimmedPath = path.join(tmpDir, "trimmed.mp4");
    await runFFmpeg(concatListPath, filterGraphPath, trimmedPath);
    console.log("[Pipeline] Trimmed video created");

    // ── 4. Upload trimmed to YouTube ──────────────────────────────────────
    await updateJob(jobId, { status: "uploading_trimmed", progress: 50 });
    await updateMatchJob(matchId, { ...jobBase, status: "uploading_trimmed", progress: 50 });

    const matchData = matchSnap.data()!;
    const teamA = matchData.teamA as string;
    const teamB = matchData.teamB as string;

    const trimmedUrl = await uploadToYouTube(
      trimmedPath,
      `[Trimmed] ${teamA} vs ${teamB} — Perspective ${perspective}`,
      `Full match VOD (trimmed rallies only). Recorded at the ${matchData.stage ?? ""} stage.`
    );
    await updateJob(jobId, { trimmedYoutubeUrl: trimmedUrl, progress: 65 });
    const { db: db2 } = getFirebaseClients();
    await db2.collection("matches").doc(matchId).update({
      [`vodUrl${perspective}`]: trimmedUrl,
      processingJob: { ...jobBase, status: "uploading_trimmed", progress: 65, trimmedYoutubeUrl: trimmedUrl },
    });

    // ── 5. Build highlights ───────────────────────────────────────────────
    const highlightRallies = extractRallies(events, true);
    console.log(`[Pipeline] ${highlightRallies.length} highlight rallies`);

    let highlightsUrl: string | null = null;

    if (highlightRallies.length > 0) {
      await updateJob(jobId, { status: "creating_highlights", progress: 70 });
      await updateMatchJob(matchId, { ...jobBase, status: "creating_highlights", progress: 70, trimmedYoutubeUrl: trimmedUrl });

      const { concatList: hlConcat, filterGraph: hlFilter } = buildFFmpegInputs(
        highlightRallies, rawPath, firstServe.timestamp
      );
      const hlConcatPath  = path.join(tmpDir, "concat_hl.txt");
      const hlFilterPath  = path.join(tmpDir, "filtergraph_hl.txt");
      const hlOutputPath  = path.join(tmpDir, "highlights.mp4");
      fs.writeFileSync(hlConcatPath, hlConcat);
      fs.writeFileSync(hlFilterPath, hlFilter);
      await runFFmpeg(hlConcatPath, hlFilterPath, hlOutputPath);
      console.log("[Pipeline] Highlights video created");

      // ── 6. Upload highlights to YouTube ──────────────────────────────────
      await updateJob(jobId, { status: "uploading_highlights", progress: 85 });
      await updateMatchJob(matchId, { ...jobBase, status: "uploading_highlights", progress: 85, trimmedYoutubeUrl: trimmedUrl });

      highlightsUrl = await uploadToYouTube(
        hlOutputPath,
        `[Highlights] ${teamA} vs ${teamB} — Perspective ${perspective}`,
        `Best rallies from the match.`
      );
      const { db: db3 } = getFirebaseClients();
      await db3.collection("matches").doc(matchId).update({
        matchHighlightsUrl: highlightsUrl,
      });
    } else {
      console.log("[Pipeline] No highlights marked — skipping highlights upload");
    }

    // ── 7. Mark complete ──────────────────────────────────────────────────
    const finalJobData: Record<string, unknown> = {
      ...jobBase,
      status: "complete",
      progress: 100,
      trimmedYoutubeUrl: trimmedUrl,
      completedAt: Date.now(),
    };
    if (highlightsUrl) finalJobData.highlightsYoutubeUrl = highlightsUrl;

    await updateJob(jobId, finalJobData);
    await updateMatchJob(matchId, finalJobData);
    console.log("[Pipeline] ✅ Complete");

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Pipeline] ❌ Error:", message);
    await updateJob(jobId, { status: "error", error: message });
    await updateMatchJob(matchId, { id: jobId, matchId, perspective, rawStoragePath, status: "error", error: message });
    throw err;

  } finally {
    // Clean up tmp files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── Express server ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "grass-volleyball-processor" });
});

app.post("/process", async (req: Request, res: Response) => {
  const { jobId, matchId, perspective, rawStoragePath } = req.body as ProcessRequest;

  if (!jobId || !matchId || !perspective || !rawStoragePath) {
    res.status(400).json({ error: "Missing required fields: jobId, matchId, perspective, rawStoragePath" });
    return;
  }

  console.log(`[Server] Received job ${jobId} — matchId=${matchId} perspective=${perspective}`);

  // Respond immediately so the caller doesn't time out; process async
  res.status(202).json({ ok: true, jobId });

  runPipeline({ jobId, matchId, perspective, rawStoragePath }).catch((err) => {
    console.error("[Server] Pipeline failed for job", jobId, err);
  });
});

checkEnv();
const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, () => {
  console.log(`🎬 Grass Volleyball Processor running on port ${PORT}`);
});
