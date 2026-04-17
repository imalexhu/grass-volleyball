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
  status: "scheduled" | "in_progress" | "complete";
  vodUrl?: string;
}

export interface Standing {
  rank: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  diff: number;
}

const sampleTeams = (n: number, prefix = "Team"): Team[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t-${prefix}-${i}`,
    name: [
      "Spike Force",
      "Sandstorm",
      "Net Ninjas",
      "Beachside Bandits",
      "Grass Goblins",
      "Adelaide Aces",
      "Coastal Crushers",
      "Dune Dogs",
    ][i] ?? `${prefix} ${i + 1}`,
    captain: ["Alex C.", "Sam R.", "Jordan T.", "Casey M.", "Riley P.", "Morgan K.", "Drew L.", "Quinn S."][i] ?? "—",
  }));

export const tournaments: Tournament[] = [
  {
    id: "trn-1",
    name: "Adelaide Summer Slam",
    dateStart: "2026-05-10",
    dateEnd: "2026-05-10",
    location: "Glenelg Foreshore",
    format: "Pool Play + Finals",
    entryFee: 80,
    maxTeams: 8,
    registeredTeams: sampleTeams(5),
    status: "open",
  },
  {
    id: "trn-2",
    name: "Autumn Open",
    dateStart: "2026-04-26",
    dateEnd: "2026-04-26",
    location: "Henley Beach",
    format: "Pool Play + Finals",
    entryFee: 80,
    maxTeams: 8,
    registeredTeams: sampleTeams(8),
    status: "full",
  },
  {
    id: "trn-3",
    name: "City Showdown",
    dateStart: "2026-04-19",
    dateEnd: "2026-04-19",
    location: "Bonython Park",
    format: "Pool Play + Finals",
    entryFee: 80,
    maxTeams: 8,
    registeredTeams: sampleTeams(8),
    status: "in_progress",
  },
  {
    id: "trn-4",
    name: "Grass Roots Cup",
    dateStart: "2026-03-22",
    dateEnd: "2026-03-22",
    location: "West Beach Reserve",
    format: "Pool Play + Finals",
    entryFee: 70,
    maxTeams: 8,
    registeredTeams: sampleTeams(8),
    status: "complete",
  },
  {
    id: "trn-5",
    name: "Hills Classic",
    dateStart: "2026-03-08",
    dateEnd: "2026-03-08",
    location: "Hahndorf Oval",
    format: "Pool Play + Finals",
    entryFee: 70,
    maxTeams: 8,
    registeredTeams: sampleTeams(8),
    status: "complete",
  },
  {
    id: "trn-6",
    name: "Winter Warm-up",
    dateStart: "2026-06-14",
    dateEnd: "2026-06-14",
    location: "Semaphore Beach",
    format: "Pool Play + Finals",
    entryFee: 80,
    maxTeams: 8,
    registeredTeams: sampleTeams(2),
    status: "open",
  },
];

export const sampleMatches: Match[] = [
  { id: "m1", stage: "pool", pool: "A", teamA: "Spike Force", teamB: "Sandstorm", court: 1, scheduledAt: "9:00 AM", scoreA: 25, scoreB: 18, status: "complete", vodUrl: "#" },
  { id: "m2", stage: "pool", pool: "A", teamA: "Net Ninjas", teamB: "Beachside Bandits", court: 2, scheduledAt: "9:00 AM", scoreA: 22, scoreB: 25, status: "complete", vodUrl: "#" },
  { id: "m3", stage: "pool", pool: "B", teamA: "Grass Goblins", teamB: "Adelaide Aces", court: 1, scheduledAt: "9:45 AM", scoreA: 25, scoreB: 21, status: "complete" },
  { id: "m4", stage: "pool", pool: "B", teamA: "Coastal Crushers", teamB: "Dune Dogs", court: 2, scheduledAt: "9:45 AM", scoreA: 19, scoreB: 25, status: "complete" },
  { id: "m5", stage: "pool", pool: "A", teamA: "Spike Force", teamB: "Net Ninjas", court: 1, scheduledAt: "10:30 AM", scoreA: 15, scoreB: 12, status: "in_progress" },
  { id: "m6", stage: "pool", pool: "A", teamA: "Sandstorm", teamB: "Beachside Bandits", court: 2, scheduledAt: "10:30 AM", status: "scheduled" },
  { id: "m7", stage: "placement", teamA: "TBD", teamB: "TBD", court: 1, scheduledAt: "1:00 PM", status: "scheduled" },
  { id: "m8", stage: "final", teamA: "TBD", teamB: "TBD", court: 1, scheduledAt: "3:00 PM", status: "scheduled" },
];

export const sampleStandings: Standing[] = [
  { rank: 1, team: "Spike Force", played: 3, won: 3, lost: 0, points: 6, diff: 32 },
  { rank: 2, team: "Net Ninjas", played: 3, won: 2, lost: 1, points: 4, diff: 12 },
  { rank: 3, team: "Beachside Bandits", played: 3, won: 1, lost: 2, points: 2, diff: -6 },
  { rank: 4, team: "Sandstorm", played: 3, won: 0, lost: 3, points: 0, diff: -38 },
  { rank: 1, team: "Grass Goblins", played: 3, won: 3, lost: 0, points: 6, diff: 28 },
  { rank: 2, team: "Coastal Crushers", played: 3, won: 2, lost: 1, points: 4, diff: 9 },
  { rank: 3, team: "Adelaide Aces", played: 3, won: 1, lost: 2, points: 2, diff: -4 },
  { rank: 4, team: "Dune Dogs", played: 3, won: 0, lost: 3, points: 0, diff: -33 },
];

export const statusLabel: Record<TournamentStatus, string> = {
  open: "Open",
  full: "Full",
  in_progress: "Live",
  complete: "Complete",
};
