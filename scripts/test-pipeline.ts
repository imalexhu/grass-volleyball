import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import fs from "fs";
import path from "path";
import readline from "readline";

// Helper for CLI prompts
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function main() {
  console.log("🏐 Grass Volleyball — E2E Pipeline Integration Test");
  console.log("===================================================\n");

  // 1. Load env variables
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET;
  const processorUrl = process.env.VITE_CLOUD_RUN_PROCESSOR_URL;

  if (!apiKey || !projectId || !storageBucket) {
    console.error("❌ Error: Missing Firebase configuration in environment variables.");
    console.error("Make sure to run this script where .env is loaded.");
    process.exit(1);
  }

  if (!processorUrl) {
    console.warn("⚠️  Warning: VITE_CLOUD_RUN_PROCESSOR_URL is not set in environment.");
  }

  // 2. Initialize Firebase Client App
  const app = initializeApp({
    apiKey,
    authDomain,
    projectId,
    storageBucket,
  });
  const db = getFirestore(app);
  const storage = getStorage(app);

  // 3. Prompt for test video file
  console.log("Step 1: Staging Test Video");
  console.log("--------------------------");
  const localVideoPath = await askQuestion("Enter the local path to your test video file (e.g. test_match.mp4): ");
  
  if (!fs.existsSync(localVideoPath)) {
    console.error(`❌ Error: Local file "${localVideoPath}" does not exist.`);
    process.exit(1);
  }

  // 4. Create casual match with dummy players in Firestore
  console.log("\nStep 2: Creating Mock Match in Firestore");
  console.log("-----------------------------------------");
  
  const dummyPlayers = [
    { userId: "player_a1", displayName: "Alex H." },
    { userId: "player_a2", displayName: "Sarah K." },
    { userId: "player_a3", displayName: "Fardeen A." },
    { userId: "player_a4", displayName: "Bec W." },
    { userId: "player_b1", displayName: "Dani L." },
    { userId: "player_b2", displayName: "Ed M." },
    { userId: "player_b3", displayName: "Faz R." },
    { userId: "player_b4", displayName: "Jay S." }
  ];

  const now = Date.now();
  const startOffset = 5; // faked 5 seconds offset

  // Build faked aligned scoring timestamps relative to match start
  // T0: Serve at 5s in video
  // T1: Point to A at 11s (duration = 6s)
  // T2: Serve at 15s
  // T3: Highlight Point to B at 23s (duration = 8s) - attributed to player_b2 (Ed M.)
  // T4: Serve at 27s
  // T5: Point to A at 33s (duration = 6s)
  const T0 = now;
  const T1 = T0 + 6000;
  const T2 = T0 + 10000;
  const T3 = T0 + 18000;
  const T4 = T0 + 22000;
  const T5 = T0 + 28000;

  const mockEvents = [
    {
      id: "ev_1",
      type: "serve",
      timestamp: T0,
      scoreA: 0,
      scoreB: 0,
      servingTeam: "A",
      rosterA: ["player_a1", "player_a2", "player_a3", "player_a4"],
      rosterB: ["player_b1", "player_b2", "player_b3", "player_b4"],
    },
    {
      id: "ev_2",
      type: "point",
      team: "A",
      timestamp: T1,
      scoreA: 1,
      scoreB: 0,
      servingTeam: "A",
      rosterA: ["player_a1", "player_a2", "player_a3", "player_a4"],
      rosterB: ["player_b1", "player_b2", "player_b3", "player_b4"],
    },
    {
      id: "ev_3",
      type: "serve",
      timestamp: T2,
      scoreA: 1,
      scoreB: 0,
      servingTeam: "A",
      rosterA: ["player_a1", "player_a2", "player_a3", "player_a4"],
      rosterB: ["player_b1", "player_b2", "player_b3", "player_b4"],
    },
    {
      id: "ev_4",
      type: "point",
      team: "B",
      timestamp: T3,
      scoreA: 1,
      scoreB: 1,
      servingTeam: "A",
      isHighlight: true,
      highlightPlayerId: "player_b2",
      highlightPlayerName: "Ed M.",
      rosterA: ["player_a1", "player_a2", "player_a3", "player_a4"],
      // Rotated Team B since they won a side-out point
      rosterB: ["player_b4", "player_b1", "player_b2", "player_b3"],
    },
    {
      id: "ev_5",
      type: "serve",
      timestamp: T4,
      scoreA: 1,
      scoreB: 1,
      servingTeam: "B",
      rosterA: ["player_a1", "player_a2", "player_a3", "player_a4"],
      rosterB: ["player_b4", "player_b1", "player_b2", "player_b3"],
    },
    {
      id: "ev_6",
      type: "point",
      team: "A",
      timestamp: T5,
      scoreA: 2,
      scoreB: 1,
      servingTeam: "B",
      rosterA: ["player_a4", "player_a1", "player_a2", "player_a3"],
      rosterB: ["player_b4", "player_b1", "player_b2", "player_b3"],
    }
  ];

  const matchData = {
    label: `E2E Pipeline Test — ${new Date().toLocaleTimeString()}`,
    teamA: "Team Alpha",
    teamB: "Team Beta",
    playersA: dummyPlayers.slice(0, 4).map(p => ({ ...p, joinedAt: now })),
    playersB: dummyPlayers.slice(4).map(p => ({ ...p, joinedAt: now })),
    activeRosterA: ["player_a1", "player_a2", "player_a3", "player_a4"],
    activeRosterB: ["player_b1", "player_b2", "player_b3", "player_b4"],
    pointTarget: 21,
    status: "action_required",
    phase: "complete",
    servingTeam: "A",
    scoreA: 2,
    scoreB: 1,
    events: mockEvents,
    videoOffsetA: startOffset,
    scheduledAt: new Date().toISOString(),
    createdAt: now,
    completedAt: now + 30000,
  };

  const matchesRef = collection(db, "matches");
  const matchDocRef = await addDoc(matchesRef, matchData);
  const matchId = matchDocRef.id;
  console.log(`✅ Staged Match Created! ID: ${matchId}`);

  // 5. Upload Video to Firebase Storage
  console.log("\nStep 3: Uploading Video to Firebase Storage");
  console.log("-------------------------------------------");
  const filename = path.basename(localVideoPath);
  const storagePath = `matches/${matchId}/raw_A_${Date.now()}_${filename}`;
  console.log(`Uploading local file to: gs://${storageBucket}/${storagePath}...`);

  const fileBuffer = fs.readFileSync(localVideoPath);
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, fileBuffer);
  console.log("✅ Upload complete!");

  // Update match doc rawStoragePathA
  await updateDoc(doc(db, "matches", matchId), {
    rawStoragePathA: storagePath
  });

  // 6. Trigger highlights processing
  console.log("\nStep 4: Triggering Cloud Run Pipeline");
  console.log("-------------------------------------");
  
  const targetProcessorUrl = processorUrl || "http://localhost:8080";
  console.log(`Processor target URL: ${targetProcessorUrl}`);
  
  const jobId = `job_test_${Math.random().toString(36).substring(2, 9)}`;

  // Set initial status to queued in matches
  await updateDoc(doc(db, "matches", matchId), {
    processingJob: { id: jobId, status: "queued", progress: 0 }
  });

  const payload = {
    jobId,
    matchId,
    perspectiveA: {
      rawStoragePath: storagePath,
      videoOffset: startOffset
    },
    winner: "A",
    events: mockEvents
  };

  try {
    const resp = await fetch(`${targetProcessorUrl}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cloud Run error ${resp.status}: ${text}`);
    }

    console.log("✅ Dispatch accepted by video processor!");
  } catch (err: any) {
    console.error("❌ Error dispatching job:", err.message);
    process.exit(1);
  }

  // 7. Subscribe to real-time updates of the match document to track processing progress
  console.log("\nStep 5: Monitoring Pipeline Status (Ctrl+C to exit)");
  console.log("---------------------------------------------------");

  let finished = false;
  const unsubscribe = onSnapshot(doc(db, "matches", matchId), (snap) => {
    if (!snap.exists()) return;
    const m = snap.data();
    const job = m.processingJob;
    if (!job) return;

    console.log(`[Status: ${job.status}] Progress: ${job.progress}%`);

    if (job.status === "complete") {
      console.log("\n===================================================");
      console.log("🎉 PIPELINE COMPLETED SUCCESSFULLY!");
      console.log(`📺 Full Match VOD: ${m.vodUrl}`);
      console.log(`⭐ Highlights Reel: ${m.matchHighlightsUrl}`);
      console.log("===================================================\n");
      finished = true;
      unsubscribe();
      process.exit(0);
    }

    if (job.status === "error") {
      console.error(`\n❌ Pipeline Error: ${job.error || "Unknown error"}`);
      finished = true;
      unsubscribe();
      process.exit(1);
    }
  });

  // Safe timeout after 15 minutes
  setTimeout(() => {
    if (!finished) {
      console.log("\n⚠️  Timeout: Job took too long. Exiting listener.");
      unsubscribe();
      process.exit(1);
    }
  }, 900000);
}

main().catch((err) => {
  console.error("❌ Execution failed:", err);
  process.exit(1);
});
