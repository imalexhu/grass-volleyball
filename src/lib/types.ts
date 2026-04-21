export type TournamentStatus = "open" | "filled" | "complete";

export const statusLabel: Record<TournamentStatus, string> = {
  open: "Open",
  filled: "Filled",
  complete: "Complete",
};

export interface Team {
  id: string;
  name: string;
  captain: string;
}

export interface Tournament {
  id: string;
  name: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  format: string;
  description: string;
  entryFee: number;
  maxTeams: number;
  registeredTeams: Team[];
  status: TournamentStatus;
}

export interface MatchEvent {
  id: string;
  type: "serve" | "point";
  team?: "A" | "B";
  timestamp: number;
  scoreA: number;
  scoreB: number;
}

export interface Match {
  id: string;
  stage: "pool" | "placement" | "final";
  pool?: "A" | "B";
  teamA: string;
  teamB: string;
  court: number;
  scheduledAt: string;
  scoreA?: number;
  scoreB?: number;
  status: "scheduled" | "complete";
  vodUrlA?: string;
  vodUrlB?: string;
  matchHighlightsUrl?: string;
  tournamentId?: string;
  label?: string;
  events?: MatchEvent[];
}

export interface Standing {
  rank: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  diff: number;
  tournamentId?: string;
}

