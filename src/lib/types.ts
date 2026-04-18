export type TournamentStatus = "open" | "full" | "in_progress" | "complete";

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
  vodUrl?: string;
  tournamentId?: string;
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

export const statusLabel: Record<TournamentStatus, string> = {
  open: "Open",
  full: "Full",
  in_progress: "Live",
  complete: "Complete",
};
