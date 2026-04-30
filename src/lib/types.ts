export type TournamentStatus = "open" | "filled" | "complete";

export const statusLabel: Record<TournamentStatus, string> = {
  open: "Open",
  filled: "Filled",
  complete: "Complete",
};

export type UserRole = "player" | "organization";

export interface UserProfile {
  id: string; // Firebase Auth UID
  email: string | null;
  displayName: string | null;
  role: UserRole;
  organizationName?: string; // Present if role is "organization"
}

export interface Team {
  id: string;
  name: string;
  captain: string;
}

export interface Tournament {
  id: string;
  organizerId: string; // The ID of the UserProfile with role "organization"
  name: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  format: string; // "8-pool" etc.
  description: string;
  entryFee: number;
  maxTeams: number;
  registeredTeams: Team[];
  status: TournamentStatus;
}

export interface MatchEvent {
  id: string;
  type: "serve" | "point" | "set-finish";
  team?: "A" | "B";
  timestamp: number;
  scoreA: number;
  scoreB: number;
  isHighlight?: boolean;
  setIndex?: number;
}

export interface Match {
  id: string;
  organizerId?: string;
  stage?: "pool" | "placement" | "final" | "freeplay";
  pool?: "A" | "B";
  teamA: string;
  teamB: string;
  court?: number;
  scheduledAt: string;
  scoreA?: number;
  scoreB?: number;
  currentSetScoreA?: number;
  currentSetScoreB?: number;
  status: "scheduled" | "live" | "complete";
  // Raw upload paths in Firebase Storage (used by Cloud Run processor)
  rawStoragePathA?: string;
  rawStoragePathB?: string;
  // Post-processed YouTube URLs
  vodUrlA?: string;
  vodUrlB?: string;
  matchHighlightsUrl?: string;
  tournamentId?: string;
  label?: string;
  events?: MatchEvent[];
  // Processing job status (embedded for easy UI subscription)
  processingJob?: VideoProcessingJob;
}

export type VideoProcessingStatus =
  | "queued"
  | "downloading"
  | "trimming"
  | "uploading_trimmed"
  | "creating_highlights"
  | "uploading_highlights"
  | "complete"
  | "error";

export interface VideoProcessingJob {
  id: string;
  matchId: string;
  perspective: "A" | "B";
  rawStoragePath: string;
  status: VideoProcessingStatus;
  progress: number; // 0–100
  trimmedYoutubeUrl?: string;
  highlightsYoutubeUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Standing {
  id: string;
  rank: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  diff: number;
  tournamentId?: string;
  pool?: "A" | "B";
}

