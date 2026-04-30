import { createFileRoute, Link } from "@tanstack/react-router";
import type { Match, VideoProcessingJob, VideoProcessingStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Video, Check, UploadCloud, Trophy, Youtube,
  Loader2, AlertCircle, Scissors, Film
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { subscribeToMatch, createProcessingJob, subscribeToProcessingJob, triggerCloudRunProcessing } from "@/lib/api";
import { ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useDropzone } from "react-dropzone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/manage/postmatch-process/$matchId")({
  component: PostMatchProcess,
  head: () => ({ meta: [{ title: "Post-Match Processing — Adelaide Grass Volleyball" }] }),
});

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STEPS: { status: VideoProcessingStatus; label: string }[] = [
  { status: "queued",              label: "Queued" },
  { status: "downloading",         label: "Downloading video" },
  { status: "trimming",            label: "Trimming rallies" },
  { status: "uploading_trimmed",   label: "Uploading trimmed VOD to YouTube" },
  { status: "creating_highlights", label: "Creating highlights reel" },
  { status: "uploading_highlights",label: "Uploading highlights to YouTube" },
  { status: "complete",            label: "Complete" },
];

function getStepIndex(status: VideoProcessingStatus) {
  return STATUS_STEPS.findIndex(s => s.status === status);
}

function StatusPipeline({ job }: { job: VideoProcessingJob }) {
  const currentIdx = getStepIndex(job.status);
  const isError = job.status === "error";

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx && !isError;
        return (
          <div key={step.status} className="flex items-center gap-3">
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black transition-colors",
              done  && "bg-success text-success-foreground",
              active && "bg-primary text-primary-foreground animate-pulse",
              !done && !active && "bg-muted text-muted-foreground",
              isError && idx === currentIdx && "bg-destructive text-destructive-foreground"
            )}>
              {done ? <Check className="h-3 w-3" /> : idx + 1}
            </div>
            <span className={cn(
              "text-xs font-medium",
              done && "text-muted-foreground line-through",
              active && "text-foreground font-bold",
              !done && !active && "text-muted-foreground"
            )}>
              {step.label}
            </span>
            {active && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
          </div>
        );
      })}
      {isError && (
        <div className="flex items-start gap-2 text-destructive text-xs mt-2 p-3 bg-destructive/10 rounded-xl">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{job.error || "An unknown error occurred."}</span>
        </div>
      )}
    </div>
  );
}

// ─── Dropzone Panel ──────────────────────────────────────────────────────────

function UploadPanel({
  teamName,
  perspective,
  matchId,
  storagePath,
  onUploadComplete,
}: {
  teamName: string;
  perspective: "A" | "B";
  matchId: string;
  storagePath: string | null;
  onUploadComplete: (storagePath: string) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: isUploading || !!storagePath,
  });

  const handleUpload = useCallback(() => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const path = `matches/${matchId}/raw_${perspective}_${selectedFile.name}`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(pct);
      },
      (err) => {
        console.error(err);
        setUploadError(err.message);
        setIsUploading(false);
        setUploadProgress(null);
      },
      () => {
        setIsUploading(false);
        setUploadProgress(null);
        onUploadComplete(path);
      }
    );
  }, [selectedFile, matchId, perspective, onUploadComplete]);

  // ── Already uploaded to Firebase Storage ─────────────────────────────────
  if (storagePath) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-success/30 bg-success/5">
        <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
          <Check className="h-5 w-5 text-success" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-success">Uploaded to Firebase Storage</div>
          <div className="text-xs text-muted-foreground font-mono truncate">{storagePath.split("/").pop()}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <Video className="h-4 w-4 text-primary" /> {teamName} — Perspective {perspective}
      </h3>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all select-none",
          isDragActive                      && "border-primary bg-primary/5 scale-[1.01]",
          !isDragActive && !selectedFile    && "border-border hover:border-primary/50 hover:bg-muted/40",
          !isDragActive && !!selectedFile   && "border-primary/40 bg-primary/5",
          isUploading                       && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />

        {!selectedFile ? (
          <>
            <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold mb-1">
              {isDragActive ? "Drop it here" : "Drag & drop the raw recording"}
            </p>
            <p className="text-xs text-muted-foreground">or click to browse — MP4, MOV, etc.</p>
          </>
        ) : (
          <div className="flex items-center gap-4 text-left">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB — click or drop to replace
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload progress */}
      {isUploading && uploadProgress !== null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading to Firebase Storage…
            </span>
            <span className="font-mono font-bold">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="flex items-center gap-2 text-destructive text-xs p-3 rounded-xl bg-destructive/10">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Upload submit button — only shown once a file is staged */}
      {selectedFile && !isUploading && (
        <Button
          onClick={handleUpload}
          className="w-full h-12 font-black rounded-2xl gap-2"
        >
          <UploadCloud className="h-4 w-4" />
          Upload "{selectedFile.name}"
        </Button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function PostMatchProcess() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);

  // Upload state per perspective
  const [storagePathA, setStoragePathA] = useState<string | null>(null);
  const [storagePathB, setStoragePathB] = useState<string | null>(null);

  // Active processing job
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [job, setJob] = useState<VideoProcessingJob | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [activeTab, setActiveTab] = useState<"A" | "B">("A");

  // Subscribe to match
  useEffect(() => {
    return subscribeToMatch(matchId, (m) => {
      setMatch(m);
      if (m.rawStoragePathA) setStoragePathA(m.rawStoragePathA);
      if (m.rawStoragePathB) setStoragePathB(m.rawStoragePathB);
      // Re-attach to existing job if page is refreshed
      if (m.processingJob?.id && !activeJobId) {
        setActiveJobId(m.processingJob.id);
      }
    });
  }, [matchId]);

  // Subscribe to processing job when one is active
  useEffect(() => {
    if (!activeJobId) return;
    return subscribeToProcessingJob(activeJobId, (j) => {
      setJob(j);
    });
  }, [activeJobId]);

  const handleUploadComplete = useCallback(async (perspective: "A" | "B", storagePath: string) => {
    if (perspective === "A") setStoragePathA(storagePath);
    else                     setStoragePathB(storagePath);

    // Persist the raw storage path to Firestore
    const { doc, updateDoc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");
    await updateDoc(doc(db, "matches", matchId), {
      [`rawStoragePath${perspective}`]: storagePath,
    });

    toast.success(`Perspective ${perspective} uploaded — ready to process ✓`);
  }, [matchId]);

  const handleProcess = async (perspective: "A" | "B") => {
    const path = perspective === "A" ? storagePathA : storagePathB;
    if (!path) { toast.error("Upload the video first"); return; }

    setIsQueuing(true);
    try {
      const jobId = await createProcessingJob(matchId, perspective, path);
      setActiveJobId(jobId);
      await triggerCloudRunProcessing(jobId, matchId, perspective, path);
      toast.success("Processing job started 🎬");
    } catch (err: any) {
      toast.error(err.message || "Failed to start processing");
    } finally {
      setIsQueuing(false);
    }
  };

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isJobActive = job && job.status !== "complete" && job.status !== "error";
  const isJobDone   = job?.status === "complete";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <Link to="/manage" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Exit
        </Link>
        <div className="text-xs font-bold text-primary px-3 py-0.5 rounded-full border border-primary/20 bg-primary/10">
          Post-Match Processing
        </div>
        <div className="w-16" />
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-6 space-y-8">
        {/* Title */}
        <div className="text-center space-y-2 mt-6">
          <Trophy className="h-12 w-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-black">{match.teamA} vs {match.teamB}</h1>
          <p className="text-muted-foreground text-sm">
            Upload the raw recording for each perspective. The server will trim rallies,
            generate a highlights reel, and upload both to YouTube.
          </p>
        </div>

        {/* If a job is running / done, show the pipeline */}
        {job && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Processing Pipeline — Perspective {job.perspective}
            </h2>
            <StatusPipeline job={job} />

            {/* Progress bar */}
            {isJobActive && (
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            )}

            {/* Results */}
            {isJobDone && (
              <div className="space-y-3">
                {job.trimmedYoutubeUrl && (
                  <a
                    href={job.trimmedYoutubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl border border-[#FF0000]/20 bg-[#FF0000]/5 hover:bg-[#FF0000]/10 transition-colors"
                  >
                    <Youtube className="h-5 w-5 text-[#FF0000] flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold">Trimmed VOD</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">{job.trimmedYoutubeUrl}</div>
                    </div>
                  </a>
                )}
                {job.highlightsYoutubeUrl && (
                  <a
                    href={job.highlightsYoutubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors"
                  >
                    <Film className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold">Highlights Reel</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[280px]">{job.highlightsYoutubeUrl}</div>
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upload tabs (hidden while job is actively running) */}
        {!isJobActive && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "A" | "B")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="A" className="gap-2">
                {storagePathA && <Check className="h-3 w-3 text-success" />}
                Perspective A ({match.teamA})
              </TabsTrigger>
              <TabsTrigger value="B" className="gap-2">
                {storagePathB && <Check className="h-3 w-3 text-success" />}
                Perspective B ({match.teamB})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="A" className="mt-4 space-y-4">
              <UploadPanel
                teamName={match.teamA}
                perspective="A"
                matchId={matchId}
                storagePath={storagePathA}
                onUploadComplete={(p) => handleUploadComplete("A", p)}
              />
              {storagePathA && !isJobDone && (
                <Button
                  className="w-full h-14 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white font-black rounded-2xl gap-2 disabled:opacity-50"
                  disabled={isQueuing}
                  onClick={() => handleProcess("A")}
                >
                  {isQueuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Youtube className="h-5 w-5" />}
                  {isQueuing ? "Starting job…" : "Process & Upload Perspective A to YouTube"}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="B" className="mt-4 space-y-4">
              <UploadPanel
                teamName={match.teamB}
                perspective="B"
                matchId={matchId}
                storagePath={storagePathB}
                onUploadComplete={(p) => handleUploadComplete("B", p)}
              />
              {storagePathB && !isJobDone && (
                <Button
                  className="w-full h-14 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white font-black rounded-2xl gap-2 disabled:opacity-50"
                  disabled={isQueuing}
                  onClick={() => handleProcess("B")}
                >
                  {isQueuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Youtube className="h-5 w-5" />}
                  {isQueuing ? "Starting job…" : "Process & Upload Perspective B to YouTube"}
                </Button>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
