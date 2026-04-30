/**
 * Test the Cloud Run worker locally.
 *
 * Usage:
 *   cd cloud-run && npx tsx src/test_worker.ts \
 *     --matchId <firestoreMatchId> \
 *     --perspective A \
 *     --rawStoragePath matches/<matchId>/raw_A_video.mp4
 *
 * Prerequisites:
 *   - Worker must be running:  npx tsx src/worker.ts
 *   - All env vars set in cloud-run/.env (or parent .env)
 *   - The raw video must already be in Firebase Storage at rawStoragePath
 */

import path from "path";
import fs from "fs";

// Load .env from cloud-run/ or project root
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

// Parse CLI args
function getArg(name: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error(`❌ Missing --${name}`);
    process.exit(1);
  }
  return process.argv[idx + 1];
}

const matchId = getArg("matchId");
const perspective = getArg("perspective") as "A" | "B";
const rawStoragePath = getArg("rawStoragePath");

// Generate a fake jobId for the test
const jobId = `test_${Date.now()}`;

const WORKER_URL = process.env.WORKER_URL ?? "http://localhost:8080";

async function main() {
  console.log("\n🎬 Cloud Run Worker Test");
  console.log(`   Worker URL:      ${WORKER_URL}`);
  console.log(`   Match ID:        ${matchId}`);
  console.log(`   Perspective:     ${perspective}`);
  console.log(`   Raw Storage Path: ${rawStoragePath}`);
  console.log(`   Job ID:          ${jobId}\n`);

  // First, check health
  const health = await fetch(`${WORKER_URL}/health`);
  if (!health.ok) {
    console.error("❌ Worker health check failed. Is the server running?");
    console.error("   Start it with:  cd cloud-run && npm run dev");
    process.exit(1);
  }
  console.log("✅ Worker is healthy\n");

  // Trigger processing
  console.log("📤 Sending /process request…");
  const resp = await fetch(`${WORKER_URL}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, matchId, perspective, rawStoragePath }),
  });

  const body = await resp.json() as Record<string, unknown>;
  if (!resp.ok) {
    console.error("❌ Process request failed:", body);
    process.exit(1);
  }

  console.log("✅ Job accepted:", body);
  console.log(`\n📊 Watch Firestore: processingJobs/${jobId}`);
  console.log("   The worker is now running asynchronously.");
  console.log("   Tail worker logs to see progress.\n");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});

