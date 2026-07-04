import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  Users,
  Video,
  Calendar,
  Plus,
  Radio,
  ArrowUpRight,
  Database,
  Trash2,
  Edit2,
  Loader2,
  Zap,
  Calendar as CalendarIcon,
  FileX,
  Volleyball,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Check,
  AlertCircle,
  Youtube,
  Film,
  Clock
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { db, storage } from "@/lib/firebase";
import {
  getTournaments,
  createTournament,
  clearAllData,
  getMatches,
  getTournament,
  deleteTournament,
  createFixtures,
  createTestTournamentWithTeams,
  completeTournament,
  createProcessingJob,
  subscribeToProcessingJob,
  triggerHighlightsProcessing,
  subscribeToMatch
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTournamentDialog } from "@/components/CreateTournamentDialog";
import { EditTournamentDialog } from "@/components/EditTournamentDialog";
import { TournamentModal } from "@/components/TournamentModal";
import { CreateMatchDialog } from "@/components/CreateMatchDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/types";
import type { Tournament, Match, VideoProcessingJob, MatchEvent } from "@/lib/types";
import { tournaments as mockTournaments } from "@/lib/mockData";

export const Route = createFileRoute("/manage/")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin — Adelaide Grass Volleyball" }] }),
});

// ─── Offset helpers ───────────────────────────────────────────────────────────
const parseOffset = (val: string): number => {
  const parts = val.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
};

const formatOffset = (sec?: number): string => {
  if (sec === undefined || sec === null || isNaN(sec)) return "00:00";
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// ─── Status Pipeline helper ───────────────────────────────────────────────────
function StatusPipeline({ job }: { job: VideoProcessingJob }) {
  const STATUS_STEPS: { status: string; label: string }[] = [
    { status: "queued",              label: "Queued" },
    { status: "downloading",         label: "Downloading video" },
    { status: "trimming",            label: "Trimming rallies" },
    { status: "uploading_trimmed",   label: "Uploading trimmed VOD to YouTube" },
    { status: "creating_highlights", label: "Creating highlights reel" },
    { status: "uploading_highlights",label: "Uploading highlights to YouTube" },
    { status: "complete",            label: "Complete" },
  ];

  const currentIdx = STATUS_STEPS.findIndex(s => s.status === job.status);
  const isError = job.status === "error";

  return (
    <div className="rounded-xl border bg-card/45 p-4 space-y-2.5">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx && !isError;
        return (
          <div key={step.status} className="flex items-center gap-3">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold transition-colors",
              done  && "bg-success text-success-foreground",
              active && "bg-primary text-primary-foreground animate-pulse",
              !done && !active && "bg-muted text-muted-foreground",
              isError && idx === currentIdx && "bg-destructive text-destructive-foreground"
            )}>
              {done ? <Check className="h-2.5 w-2.5" /> : idx + 1}
            </div>
            <span className={cn(
              "text-xs font-semibold",
              done && "text-muted-foreground line-through",
              active && "text-foreground font-black",
              !done && !active && "text-muted-foreground"
            )}>
              {step.label}
            </span>
            {active && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
          </div>
        );
      })}
      {isError && (
        <div className="flex items-start gap-2 text-destructive text-xs mt-1 p-2 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{job.error || "An unknown error occurred."}</span>
        </div>
      )}
    </div>
  );
}

// ─── Upload Dropzone helper ──────────────────────────────────────────────────
interface UploadPanelProps {
  teamName: string;
  perspective: "A" | "B";
  matchId: string;
  storagePath?: string;
  offset?: number;
  onUploadComplete: (storagePath: string) => void;
  onOffsetChange: (val: string) => void;
}

function UploadPanel({
  teamName,
  perspective,
  matchId,
  storagePath,
  offset,
  onUploadComplete,
  onOffsetChange,
}: UploadPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [offsetStr, setOffsetStr] = useState(formatOffset(offset));

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

    const path = `matches/${matchId}/raw_${perspective}_${Date.now()}_${selectedFile.name}`;
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

  return (
    <div className="space-y-3.5 bg-card/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm flex flex-col justify-between h-full">
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-primary" /> Camera {perspective} ({teamName})
        </h4>

        {storagePath ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-success/30 bg-success/5">
            <Check className="h-4 w-4 text-success flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-success">Raw Video Staged</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                {storagePath.split("/").pop()}
              </div>
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none text-xs",
              isDragActive && "border-primary bg-primary/5 scale-[1.01]",
              !isDragActive && !selectedFile && "border-border hover:border-primary/50 hover:bg-muted/40",
              !isDragActive && !!selectedFile && "border-primary/45 bg-primary/5",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            {!selectedFile ? (
              <div className="space-y-1">
                <UploadCloud className="h-7 w-7 mx-auto text-muted-foreground" />
                <p className="font-semibold">Drag & drop raw recording</p>
                <p className="text-[10px] text-muted-foreground">or click to browse</p>
              </div>
            ) : (
              <div className="text-left space-y-1">
                <p className="font-bold truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            )}
          </div>
        )}

        {/* Upload progress */}
        {isUploading && uploadProgress !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Uploading to Storage...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <div className="flex items-center gap-1.5 text-destructive text-[10px] p-2 rounded-lg bg-destructive/10">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-white/5">
        {/* Offset Input */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Clock className="h-3 w-3" /> First Serve Time
          </label>
          <Input
            value={offsetStr}
            onChange={(e) => {
              setOffsetStr(e.target.value);
              onOffsetChange(e.target.value);
            }}
            placeholder="e.g. 02:15 or 01:05:30"
            disabled={isUploading}
            className="h-9 rounded-lg font-mono text-xs"
          />
        </div>

        {selectedFile && !isUploading && !storagePath && (
          <Button
            size="sm"
            onClick={handleUpload}
            className="w-full h-9 font-bold rounded-lg text-xs gap-1"
          >
            <UploadCloud className="h-3.5 w-3.5" /> Upload File
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Consolidate Video Processing Panel ───────────────────────────────────────
function VideoProcessPanel({ match }: { match: Match }) {
  const [liveMatch, setLiveMatch] = useState<Match>(match);
  const [activeJobId, setActiveJobId] = useState<string | null>(match.processingJob?.id || null);
  const [job, setJob] = useState<VideoProcessingJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [offsetA, setOffsetA] = useState<string>("");
  const [offsetB, setOffsetB] = useState<string>("");

  // Real-time subscribe to the match document
  useEffect(() => {
    return subscribeToMatch(match.id, (m) => {
      setLiveMatch(m);
      if (m.processingJob?.id) {
        setActiveJobId(m.processingJob.id);
      }
    });
  }, [match.id]);

  // Subscribe to processing job updates
  useEffect(() => {
    if (!activeJobId) return;
    return subscribeToProcessingJob(activeJobId, (j) => {
      setJob(j);
    });
  }, [activeJobId]);

  const handleUploadComplete = async (perspective: "A" | "B", storagePath: string) => {
    const matchRef = doc(db, "matches", match.id);
    await updateDoc(matchRef, {
      [`rawStoragePath${perspective}`]: storagePath,
    });
    toast.success(`Camera ${perspective} video uploaded! ✓`);
  };

  const handleStartProcessing = async () => {
    const rawPathA = liveMatch.rawStoragePathA;
    const rawPathB = liveMatch.rawStoragePathB;

    if (!rawPathA && !rawPathB) {
      toast.error("Please upload at least one video perspective first.");
      return;
    }

    setIsProcessing(true);
    try {
      const secA = offsetA ? parseOffset(offsetA) : (liveMatch.videoOffsetA ?? 0);
      const secB = offsetB ? parseOffset(offsetB) : (liveMatch.videoOffsetB ?? 0);

      // Save offsets first
      const matchRef = doc(db, "matches", match.id);
      await updateDoc(matchRef, {
        videoOffsetA: secA,
        videoOffsetB: secB,
      });

      // Rallies/events are required
      const events = liveMatch.events || [];
      if (events.length === 0) {
        throw new Error("Match has no scoring events recorded.");
      }

      // Create a processing job in Firestore. We set perspective A as placeholder
      const primaryPath = rawPathA || rawPathB || "";
      const jobId = await createProcessingJob(match.id, "A", primaryPath);
      setActiveJobId(jobId);

      // Payload structure supporting single / double perspective fallback
      const payload: {
        perspectiveA?: { rawStoragePath: string; videoOffset: number };
        perspectiveB?: { rawStoragePath: string; videoOffset: number };
        winner: "A" | "B";
        events: MatchEvent[];
      } = {
        winner: (liveMatch.scoreA ?? 0) > (liveMatch.scoreB ?? 0) ? "A" : "B",
        events: events,
      };

      if (rawPathA) {
        payload.perspectiveA = { rawStoragePath: rawPathA, videoOffset: secA };
      }
      if (rawPathB) {
        payload.perspectiveB = { rawStoragePath: rawPathB, videoOffset: secB };
      }

      await triggerHighlightsProcessing(jobId, match.id, payload);
      toast.success("Highlight creation task dispatched successfully! 🎬");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start highlights generation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isJobActive = job && job.status !== "complete" && job.status !== "error";
  const isJobDone   = job?.status === "complete";
  const readyToProcess = (liveMatch.rawStoragePathA || liveMatch.rawStoragePathB) && !isJobActive && !isJobDone;

  return (
    <div className="p-5 border-t bg-muted/20 space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Camera A */}
        <UploadPanel
          teamName={liveMatch.teamA || "Team A"}
          perspective="A"
          matchId={match.id}
          storagePath={liveMatch.rawStoragePathA}
          offset={liveMatch.videoOffsetA}
          onUploadComplete={(p) => handleUploadComplete("A", p)}
          onOffsetChange={setOffsetA}
        />

        {/* Camera B */}
        <UploadPanel
          teamName={liveMatch.teamB || "Team B"}
          perspective="B"
          matchId={match.id}
          storagePath={liveMatch.rawStoragePathB}
          offset={liveMatch.videoOffsetB}
          onUploadComplete={(p) => handleUploadComplete("B", p)}
          onOffsetChange={setOffsetB}
        />
      </div>

      {/* Pipeline Status */}
      {job && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-primary" /> Processing Status
          </h4>
          <StatusPipeline job={job} />

          {isJobActive && (
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Youtube Results */}
      {isJobDone && (
        <div className="grid md:grid-cols-2 gap-3 pt-2">
          {liveMatch.vodUrl && (
            <a
              href={liveMatch.vodUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
            >
              <Youtube className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold">Trimmed Match VOD</div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{liveMatch.vodUrl}</div>
              </div>
            </a>
          )}
          {liveMatch.matchHighlightsUrl && (
            <a
              href={liveMatch.matchHighlightsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
            >
              <Film className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold">Match Highlights</div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{liveMatch.matchHighlightsUrl}</div>
              </div>
            </a>
          )}
        </div>
      )}

      {/* Process Button */}
      {readyToProcess && (
        <Button
          onClick={handleStartProcessing}
          disabled={isProcessing}
          className="w-full h-12 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-black text-sm rounded-xl shadow-glow gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> DISPATCHING PIPELINE...
            </>
          ) : (
            <>
              <Film className="h-4 w-4" /> CREATE MATCH HIGHLIGHTS
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Main Admin Dashboard Component ──────────────────────────────────────────
function Admin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const { userProfile } = useAuth();
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const isAdmin = userProfile?.role === "admin";
  const isOrg = userProfile?.role === "organization";

  const { data: rawTournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
  });

  const tournaments = rawTournaments.filter(t => {
    if (isAdmin) return true;
    if (isOrg) return t.organizerId === userProfile.id;
    return false;
  });

  const { data: rawMatches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ["all-matches"],
    queryFn: () => getMatches(),
  });

  if (!isLoading && !isLoadingMatches && userProfile && userProfile.role === "player") {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md px-6">
          <div className="bg-primary/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Your account is currently set to <strong>Player</strong>. Only Organization or Administrator accounts can manage tournaments and matches.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild variant="outline">
              <Link to="/">Return to Home</Link>
            </Button>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-4">
              Contact an administrator to upgrade your role.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allMatches = rawMatches.filter(m => {
    if (isAdmin) return true;
    if (isOrg) {
      if (m.organizerId === userProfile.id || m.createdBy === userProfile.id) return true;
      if (m.tournamentId) {
        return tournaments.some(t => t.id === m.tournamentId);
      }
      return false;
    }
    return false;
  });

  // Categorize matches based on statuses
  // ACTIVE: "scheduled" | "live" | "active"
  const activeMatches = allMatches.filter(
    (m) => m.status === "active" || m.status === "scheduled" || m.status === "live"
  );
  // ACTION REQUIRED: "action_required"
  const actionRequiredMatches = allMatches.filter(
    (m) => m.status === "action_required"
  );
  // PROCESSED: "processed" | "complete"
  const processedMatches = allMatches.filter(
    (m) => m.status === "processed" || m.status === "complete"
  );

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!userProfile) throw new Error("Must be logged in to seed data");
      // Seed tournaments
      for (const t of mockTournaments) {
        const { id, ...data } = t;
        await createTournament({ ...data, organizerId: userProfile.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Successfully seeded mock data to Firestore");
    },
    onError: (error) => {
      console.error("Failed to seed data:", error);
      toast.error("Failed to seed data. Check console for details.");
    }
  });

  const clearMutation = useMutation({
    mutationFn: clearAllData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Successfully cleared all data from Firestore");
    },
    onError: (error) => {
      console.error("Failed to clear data:", error);
      toast.error("Failed to clear data. Check console for details.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Tournament deleted");
    },
    onError: (error) => {
      console.error("Failed to delete tournament:", error);
      toast.error("Failed to delete tournament");
    }
  });

  const fixtureMutation = useMutation({
    mutationFn: createFixtures,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Fixtures generated and matches created!");
    },
    onError: (error: any) => {
      console.error("Failed to create fixtures:", error);
      toast.error(error.message || "Failed to create fixtures");
    }
  });

  const testFixtureMutation = useMutation({
    mutationFn: () => createTestTournamentWithTeams(userProfile?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Created test tournament with 8 teams!");
    },
    onError: (error) => {
      console.error("Failed to create test tournament:", error);
      toast.error("Failed to create test tournament");
    }
  });

  const completeMutation = useMutation({
    mutationFn: completeTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament marked as complete");
    },
    onError: (error) => {
      console.error("Failed to complete tournament:", error);
      toast.error("Failed to mark tournament as complete");
    }
  });

  const open = tournaments.filter((t) => t.status === "open").length;
  const teams = tournaments.reduce((s, t) => s + (t.registeredTeams?.length || 0), 0);

  return (
    <div className="flex-1 w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Dashboard Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary mb-1">Manage</div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {isOrg ? "Organization Dashboard" : "Global Dashboard"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive border-border hover:bg-destructive/10 rounded-xl"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                      clearMutation.mutate();
                    }
                  }}
                  disabled={clearMutation.isPending || isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearMutation.isPending ? "Clearing..." : "Clear Data"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  <Database className="h-4 w-4 mr-2" />
                  {seedMutation.isPending ? "Seeding..." : "Seed Data"}
                </Button>
              </>
            )}
            <CreateTournamentDialog />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Stat icon={Calendar} label="Open registrations" value={open} />
          <Stat icon={Users} label="Total registered teams" value={teams} />
          <Stat icon={Video} label="VOD jobs pending" value={actionRequiredMatches.length} accent={actionRequiredMatches.length > 0} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-10">
            {/* Tournaments List Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tournaments</h2>
              </div>
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Teams</th>
                      <th className="px-4 py-3 text-right">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-5 w-12 ml-auto" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-8 w-24 ml-auto" /></td>
                        </tr>
                      ))
                    ) : tournaments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <CalendarIcon className="h-8 w-8 mb-3 text-muted-foreground/50" />
                            <p className="text-sm font-medium">No tournaments found</p>
                            <p className="text-xs mt-1">Seed some data or create a new tournament to get started.</p>
                          </div>
                        </td>
                      </tr>
                    ) : tournaments.map((t) => (
                      <tr
                        key={t.id}
                        className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setActiveTournament(t)}
                      >
                        <td className="px-4 py-3 font-semibold group-hover:text-primary transition-colors">{t.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(t.dateStart).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {t.registeredTeams?.length || 0}/{t.maxTeams}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-xs",
                              t.status === "open" && "border-primary/30 bg-primary/10 text-primary",
                              t.status === "filled" && "border-warning/30 bg-warning/10 text-warning",
                              t.status === "complete" && "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {statusLabel[t.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {t.status === "filled" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => fixtureMutation.mutate(t.id)}
                                  disabled={fixtureMutation.isPending}
                                  title="Generate Fixtures"
                                >
                                  {fixtureMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                  onClick={() => {
                                    if (window.confirm(`Mark "${t.name}" as complete?`)) {
                                      completeMutation.mutate(t.id);
                                    }
                                  }}
                                  disabled={completeMutation.isPending}
                                  title="Mark Complete"
                                >
                                  {completeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                                </Button>
                              </>
                            )}
                            <EditTournamentDialog tournament={t} />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete "${t.name}"?`)) {
                                    deleteMutation.mutate(t.id);
                                  }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Matches Management Single Tabs Interface */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Matches</h2>

              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-xl">
                  <TabsTrigger value="active" className="rounded-lg text-xs font-bold gap-1.5">
                    Active ({activeMatches.length})
                  </TabsTrigger>
                  <TabsTrigger value="action" className="rounded-lg text-xs font-bold gap-1.5">
                    Action Required ({actionRequiredMatches.length})
                  </TabsTrigger>
                  <TabsTrigger value="processed" className="rounded-lg text-xs font-bold gap-1.5">
                    Processed ({processedMatches.length})
                  </TabsTrigger>
                </TabsList>

                {/* 1. ACTIVE MATCHES TAB */}
                <TabsContent value="active" className="mt-4">
                  <div className="rounded-2xl border border-border bg-card overflow-hidden shadow">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Match Info</th>
                          <th className="px-4 py-3 text-left">Court</th>
                          <th className="px-4 py-3 text-right">Score</th>
                          <th className="px-4 py-3 text-right">Status</th>
                          <th className="px-4 py-3 text-right">Scoring</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingMatches ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-4 py-3"><Skeleton className="h-8 w-40" /></td>
                              <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                              <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-12 ml-auto" /></td>
                              <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                              <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                            </tr>
                          ))
                        ) : activeMatches.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center">
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <Volleyball className="h-8 w-8 mb-3 text-muted-foreground/50 animate-bounce" />
                                <p className="text-sm font-bold">No active matches</p>
                                <p className="text-xs mt-1">Create a new casual match to get started.</p>
                              </div>
                            </td>
                          </tr>
                        ) : activeMatches.map((m) => (
                          <tr key={m.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-bold">
                                  {m.label || `${m.teamA} vs ${m.teamB}`}
                                </span>
                                {m.joinCodeA && (
                                  <span className="text-[10px] text-primary font-semibold font-mono tracking-wide mt-0.5">
                                    Join: {m.joinCodeA} / {m.joinCodeB}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-muted-foreground">
                              {m.court ? `Court ${m.court}` : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-right font-black tabular-nums">
                              {m.status === "live" || m.phase === "live" ? (
                                <span className="text-destructive animate-pulse">{m.scoreA ?? 0} - {m.scoreB ?? 0}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs font-normal">Setup</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={cn(
                                "inline-flex rounded-full border px-2.5 py-0.5 text-[9px] uppercase font-bold tracking-wider",
                                (m.status === "live" || m.phase === "live") ? "border-destructive/30 bg-destructive/10 text-destructive animate-pulse" : "border-border bg-muted text-muted-foreground"
                              )}>
                                {m.phase || m.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button asChild size="sm" variant="ghost" className="h-8 group/btn rounded-lg">
                                <Link to="/manage/score/$matchId" params={{ matchId: m.id }}>
                                  Score <Zap className="ml-1.5 h-3.5 w-3.5 text-primary group-hover/btn:fill-primary" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* 2. ACTION REQUIRED TAB (Expandable Processing Panel) */}
                <TabsContent value="action" className="mt-4 space-y-3">
                  {isLoadingMatches ? (
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  ) : actionRequiredMatches.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-12 text-center bg-card">
                      <Video className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-muted-foreground">All caught up!</h4>
                      <p className="text-xs text-muted-foreground/85 mt-1">
                        No matches currently require video uploads.
                      </p>
                    </div>
                  ) : actionRequiredMatches.map((m) => {
                    const isExpanded = expandedMatchId === m.id;
                    return (
                      <div key={m.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow transition-all">
                        {/* Header Panel */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedMatchId(isExpanded ? null : m.id)}
                        >
                          <div className="space-y-1 min-w-0">
                            <h3 className="text-sm font-bold truncate">{m.label || `${m.teamA} vs ${m.teamB}`}</h3>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                                Score: {m.scoreA} - {m.scoreB}
                              </span>
                              <span>•</span>
                              <span>Completed {m.completedAt ? new Date(m.completedAt).toLocaleDateString() : ""}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="inline-flex rounded-full border border-warning/30 bg-warning/10 text-warning px-2.5 py-0.5 text-[9px] uppercase font-bold tracking-wider animate-pulse">
                              Upload Video
                            </span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Collapsible Upload details */}
                        {isExpanded && <VideoProcessPanel match={m} />}
                      </div>
                    );
                  })}
                </TabsContent>

                {/* 3. PROCESSED TAB */}
                <TabsContent value="processed" className="mt-4">
                  <div className="rounded-2xl border border-border bg-card overflow-hidden shadow">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Match</th>
                          <th className="px-4 py-3 text-right">Final Score</th>
                          <th className="px-4 py-3 text-right">YouTube Links</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingMatches ? (
                          Array.from({ length: 2 }).map((_, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-4 py-3"><Skeleton className="h-8 w-32" /></td>
                              <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                              <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-32 ml-auto" /></td>
                              <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                            </tr>
                          ))
                        ) : processedMatches.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center">
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <FileX className="h-8 w-8 mb-3 text-muted-foreground/50" />
                                <p className="text-sm font-medium">No processed matches</p>
                              </div>
                            </td>
                          </tr>
                        ) : processedMatches.map((m) => (
                          <tr key={m.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold">{m.label || `${m.teamA} vs ${m.teamB}`}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{m.stage || "casual"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-black tabular-nums">
                              {m.scoreA} - {m.scoreB}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-2">
                                {m.vodUrl ? (
                                  <a
                                    href={m.vodUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-md text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                    title="Trimmed VOD"
                                  >
                                    <Youtube className="h-4 w-4" />
                                  </a>
                                ) : m.vodUrlA ? (
                                  <a
                                    href={m.vodUrlA}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-md text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                    title="Camera A VOD"
                                  >
                                    <Youtube className="h-4 w-4" />
                                  </a>
                                ) : null}

                                {m.matchHighlightsUrl && (
                                  <a
                                    href={m.matchHighlightsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-md text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
                                    title="Highlights"
                                  >
                                    <Film className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex rounded-full border border-success/30 bg-success/10 text-success px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Quick actions sidebar */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick actions</h2>
            <div className="space-y-2">
              <CreateMatchDialog />
              {isAdmin && (
                <>
                  <Action
                    icon={Zap}
                    label="Quick Test: 8-Team Fixture"
                    onClick={() => testFixtureMutation.mutate()}
                    loading={testFixtureMutation.isPending}
                  />
                  <Action icon={Users} label="Manage users" />
                </>
              )}
              {isOrg && (
                <Action icon={Users} label="Organization Profile" onClick={() => navigate({ to: "/org/$orgId", params: { orgId: userProfile?.id || "unknown" } })} />
              )}
              <Action icon={Video} label="VOD pipeline" />
            </div>
          </div>
        </div>
      </div>

      <TournamentModal
        tournament={activeTournament}
        open={!!activeTournament}
        onOpenChange={(v) => !v && setActiveTournament(null)}
        isAdmin={true}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 shadow transition-all",
      accent ? "border-primary/20 ring-1 ring-primary/10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.1)]" : "border-border"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-semibold">{label}</span>
        <Icon className={cn("h-4 w-4", accent ? "text-primary animate-pulse" : "text-muted-foreground")} />
      </div>
      <div className="mt-3 text-3xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  loading
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition-all text-left font-semibold",
        loading && "opacity-50 pointer-events-none"
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-3">
        {loading ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <Icon className="h-4 w-4 text-primary" />}
        {label}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
