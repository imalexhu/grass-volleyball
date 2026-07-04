/**
 * Grass Volleyball — Cloud Run Video Processor
 *
 * Receives POST /process  { jobId, matchId, perspectiveA, perspectiveB, winner, events }
 * Pipeline:
 *   1. Download raw video(s) from Firebase Storage → /tmp/{jobId}/raw_A.mp4, raw_B.mp4
 *   2. Determine winning perspective and generate the Full Match VOD
 *   3. Generate combined highlights reel alternating perspectives when both are available
 *   4. Upload both to YouTube (unlisted)
 *   5. Update Firestore matches + job documents, and create user notifications
 *   6. Clean up /tmp
 */

import express, { Request, Response } from "express";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
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
interface MatchEvent {
  id: string;
  type: "serve" | "point" | "set-finish";
  team?: "A" | "B";
  timestamp: number;
  scoreA: number;
  scoreB: number;
  isHighlight?: boolean;
}

interface CameraConfig {
  rawStoragePath: string;
  videoOffset: number;
}

interface ProcessRequest {
  jobId: string;
  matchId: string;
  perspectiveA?: CameraConfig;
  perspectiveB?: CameraConfig;
  winner: "A" | "B";
  events: MatchEvent[];
}

interface RallySegment {
  serve: MatchEvent;
  point: MatchEvent;
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

function buildFFmpegInputs(
  rallies: RallySegment[],
  rawVideoPath: string,
  firstServeTimestamp: number,
  videoOffset: number
): { concatList: string; filterGraph: string } {
  let concatList = "";
  const drawtextParts: string[] = [];
  let currentFinalTime = 0;

  for (const rally of rallies) {
    let startSec = videoOffset + (rally.serve.timestamp - firstServeTimestamp) / 1000 - 2;
    if (startSec < 0) startSec = 0;
    const endSec = videoOffset + (rally.point.timestamp - firstServeTimestamp) / 1000 + 2;
    const duration = endSec - startSec;

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

async function runFFmpegConcat(
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

  console.log("[FFmpeg] Concat running:", cmd);
  const { stdout, stderr } = await execAsync(cmd);
  if (stdout) console.log("[FFmpeg stdout]", stdout);
  if (stderr) console.log("[FFmpeg stderr]", stderr);
}

// Transcode a single trimmed segment to uniform specs (1280x720, 30fps, 44.1kHz AAC)
async function transcodeHighlightSegment(
  inputPath: string,
  outputPath: string,
  startSec: number,
  duration: number,
  scoreText: string
): Promise<void> {
  const cmd = [
    "ffmpeg -y",
    `-ss ${startSec.toFixed(3)}`,
    `-t ${duration.toFixed(3)}`,
    `-i "${inputPath}"`,
    `-vf "scale=1280:720,drawtext=text='${scoreText}':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=50"`,
    `-c:v libx264 -preset fast -crf 22`,
    `-c:a aac -b:a 128k -ar 44100`,
    `-r 30`,
    `"${outputPath}"`,
  ].join(" ");

  console.log("[FFmpeg] Transcode segment running:", cmd);
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
  const { jobId, matchId, perspectiveA, perspectiveB, winner, events } = req;
  const tmpDir = `/tmp/${jobId}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const jobBase = { id: jobId, matchId, status: "queued", progress: 0 };
  const { db, storage } = getFirebaseClients();

  try {
    // ── 1. Download raw videos ────────────────────────────────────────────
    await updateJob(jobId, { status: "downloading", progress: 5 });
    await updateMatchJob(matchId, { ...jobBase, status: "downloading", progress: 5 });

    let rawPathA = "";
    let rawPathB = "";

    if (perspectiveA?.rawStoragePath) {
      rawPathA = path.join(tmpDir, "raw_A.mp4");
      console.log(`[Pipeline] Downloading Camera A ${perspectiveA.rawStoragePath} → ${rawPathA}`);
      await storage.bucket().file(perspectiveA.rawStoragePath).download({ destination: rawPathA });
    }

    if (perspectiveB?.rawStoragePath) {
      rawPathB = path.join(tmpDir, "raw_B.mp4");
      console.log(`[Pipeline] Downloading Camera B ${perspectiveB.rawStoragePath} → ${rawPathB}`);
      await storage.bucket().file(perspectiveB.rawStoragePath).download({ destination: rawPathB });
    }

    if (!rawPathA && !rawPathB) {
      throw new Error("No raw videos downloaded successfully.");
    }

    const firstServe = events.find((e) => e.type === "serve");
    if (!firstServe) throw new Error("No serve event found — cannot align timestamps");
    const firstServeTimestamp = firstServe.timestamp;

    // Fetch match label
    const matchSnap = await db.collection("matches").doc(matchId).get();
    const matchData = matchSnap.data() || {};
    const matchLabel = matchData.label || "Casual Match";
    const teamA = matchData.teamA || "Team A";
    const teamB = matchData.teamB || "Team B";

    // ── 2. Determine and Trim Full Match VOD ──────────────────────────────
    await updateJob(jobId, { status: "trimming", progress: 20 });
    await updateMatchJob(matchId, { ...jobBase, status: "trimming", progress: 20 });

    // Try winning team perspective first; fallback to whatever is available
    let chosenCam: CameraConfig;
    let chosenPath: string;
    let chosenPerspective: "A" | "B";

    if (winner === "A" && rawPathA) {
      chosenCam = perspectiveA!;
      chosenPath = rawPathA;
      chosenPerspective = "A";
    } else if (winner === "B" && rawPathB) {
      chosenCam = perspectiveB!;
      chosenPath = rawPathB;
      chosenPerspective = "B";
    } else {
      // Fallback
      if (rawPathA) {
        chosenCam = perspectiveA!;
        chosenPath = rawPathA;
        chosenPerspective = "A";
      } else {
        chosenCam = perspectiveB!;
        chosenPath = rawPathB;
        chosenPerspective = "B";
      }
    }

    console.log(`[Pipeline] Trimming Match VOD using Perspective ${chosenPerspective}`);
    const allRallies = extractRallies(events);
    const { concatList, filterGraph } = buildFFmpegInputs(
      allRallies,
      chosenPath,
      firstServeTimestamp,
      chosenCam.videoOffset
    );

    const concatListPath = path.join(tmpDir, "concat_all.txt");
    const filterGraphPath = path.join(tmpDir, "filtergraph_all.txt");
    fs.writeFileSync(concatListPath, concatList);
    fs.writeFileSync(filterGraphPath, filterGraph);

    const trimmedPath = path.join(tmpDir, "trimmed.mp4");
    await runFFmpegConcat(concatListPath, filterGraphPath, trimmedPath);
    console.log("[Pipeline] Trimmed VOD created");

    // ── 3. Upload trimmed VOD to YouTube ──────────────────────────────────
    await updateJob(jobId, { status: "uploading_trimmed", progress: 50 });
    await updateMatchJob(matchId, { ...jobBase, status: "uploading_trimmed", progress: 50 });

    const trimmedUrl = await uploadToYouTube(
      trimmedPath,
      `${matchLabel} — Full Match`,
      `Full trimmed rallies from winning team perspective (${chosenPerspective}).`
    );

    // Save VOD Url to Match
    await db.collection("matches").doc(matchId).update({
      vodUrl: trimmedUrl,
    });

    // ── 4. Generate combined highlights reel ──────────────────────────────
    const highlightRallies = extractRallies(events, true);
    console.log(`[Pipeline] Found ${highlightRallies.length} highlight rallies.`);

    let highlightsUrl: string | null = null;

    if (highlightRallies.length > 0) {
      await updateJob(jobId, { status: "creating_highlights", progress: 70 });
      await updateMatchJob(matchId, { ...jobBase, status: "creating_highlights", progress: 70 });

      const segmentPaths: string[] = [];

      for (let i = 0; i < highlightRallies.length; i++) {
        const rally = highlightRallies[i];
        const scoringTeam = rally.point.team || "A";

        // Alternate camera depending on scoring team, falling back to single if needed
        let hlCam: CameraConfig;
        let hlPath: string;

        if (scoringTeam === "A" && rawPathA) {
          hlCam = perspectiveA!;
          hlPath = rawPathA;
        } else if (scoringTeam === "B" && rawPathB) {
          hlCam = perspectiveB!;
          hlPath = rawPathB;
        } else {
          hlCam = rawPathA ? perspectiveA! : perspectiveB!;
          hlPath = rawPathA ? rawPathA : rawPathB;
        }

        let startSec = hlCam.videoOffset + (rally.serve.timestamp - firstServeTimestamp) / 1000 - 2;
        if (startSec < 0) startSec = 0;
        const endSec = hlCam.videoOffset + (rally.point.timestamp - firstServeTimestamp) / 1000 + 2;
        const duration = endSec - startSec;

        const segmentPath = path.join(tmpDir, `hl_segment_${i}.mp4`);
        const scoreText = `${rally.point.scoreA} - ${rally.point.scoreB}`;

        await transcodeHighlightSegment(hlPath, segmentPath, startSec, duration, scoreText);
        segmentPaths.push(segmentPath);
      }

      // Create concat list of segment files
      const hlConcatListPath = path.join(tmpDir, "concat_hl.txt");
      let hlConcatStr = "";
      for (const segPath of segmentPaths) {
        hlConcatStr += `file '${segPath.replace(/'/g, "'\\''")}'\n`;
      }
      fs.writeFileSync(hlConcatListPath, hlConcatStr);

      const highlightsPath = path.join(tmpDir, "highlights.mp4");
      // Concatenate the transcoded segments (copy codec since they are uniform specs)
      const hlCmd = `ffmpeg -y -f concat -safe 0 -i "${hlConcatListPath}" -c copy "${highlightsPath}"`;
      console.log("[FFmpeg] Highlights concat running:", hlCmd);
      await execAsync(hlCmd);

      // Upload highlights to YouTube
      await updateJob(jobId, { status: "uploading_highlights", progress: 85 });
      await updateMatchJob(matchId, { ...jobBase, status: "uploading_highlights", progress: 85 });

      highlightsUrl = await uploadToYouTube(
        highlightsPath,
        `${matchLabel} — Highlights`,
        `Rallies compilation of ${teamA} vs ${teamB}.`
      );

      // Save Highlights Url to Match
      await db.collection("matches").doc(matchId).update({
        matchHighlightsUrl: highlightsUrl,
      });
    }

    // ── 5. Complete pipeline & create notifications ──────────────────────
    const finalJobData: Record<string, unknown> = {
      status: "complete",
      progress: 100,
      completedAt: Date.now(),
      trimmedYoutubeUrl: trimmedUrl,
    };
    if (highlightsUrl) {
      finalJobData.highlightsYoutubeUrl = highlightsUrl;
    }

    await updateJob(jobId, finalJobData);

    await db.collection("matches").doc(matchId).update({
      status: "processed",
      processingJob: finalJobData,
    });

    // Create notifications for all participants in active rosters
    const activeParticipants = Array.from(new Set([...(matchData.activeRosterA || []), ...(matchData.activeRosterB || [])]));
    for (const uid of activeParticipants) {
      if (!uid) continue;
      const notifRef = db.collection("notifications").doc();
      await notifRef.set({
        id: notifRef.id,
        userId: uid,
        type: "video_processed",
        matchId: matchId,
        title: "Match Videos Ready! 📹",
        message: `VOD and highlights are now available for ${matchLabel}.`,
        read: false,
        createdAt: Date.now(),
      });
    }

    console.log("[Pipeline] ✅ Completed successfully.");

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Pipeline] ❌ Error occurred:", message);
    await updateJob(jobId, { status: "error", error: message });
    await updateMatchJob(matchId, { status: "error", error: message });
    throw err;
  } finally {
    // Clean up temporary workspace directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// ─── Express server ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "grass-volleyball-processor" });
});

app.post("/process", async (req: Request, res: Response) => {
  const { jobId, matchId, perspectiveA, perspectiveB, winner, events } = req.body as ProcessRequest;

  if (!jobId || !matchId || (!perspectiveA && !perspectiveB) || !winner || !events) {
    res.status(400).json({ error: "Missing required fields: jobId, matchId, perspectiveA/B, winner, events" });
    return;
  }

  console.log(`[Server] Received consolidated job ${jobId} — matchId=${matchId}`);

  // Dispatch job asynchronously and return 202 immediately
  res.status(202).json({ ok: true, jobId });

  runPipeline({ jobId, matchId, perspectiveA, perspectiveB, winner, events }).catch((err) => {
    console.error("[Server] Pipeline failed asynchronously for job", jobId, err);
  });
});

checkEnv();
const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, () => {
  console.log(`🎬 Grass Volleyball Processor running on port ${PORT}`);
});
