import { MatchEvent } from "./types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Excludes I, O

/**
 * Generates a unique 4-character join code containing uppercase A-Z (excluding confusing letters I and O).
 */
export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return code;
}

/**
 * Validates whether a join code matches the 4-letter uppercase criteria (excluding I and O).
 */
export function isValidJoinCode(code: string): boolean {
  return /^[A-HJ-NP-Z]{4}$/.test(code);
}

/**
 * Rotates a roster clockwise.
 * The last player moves to position 1 (index 0) and becomes the server.
 * Input: [pos1, pos2, ...] -> Output: [posLast, pos1, pos2, ...]
 */
export function rotateClockwise(roster: string[]): string[] {
  if (roster.length <= 1) return roster;
  const last = roster[roster.length - 1];
  const rest = roster.slice(0, roster.length - 1);
  return [last, ...rest];
}

/**
 * Returns the 2D court quadrant row/col index (0 or 1) for a given active roster position index.
 * Team A is on top (looking down), Team B is on the bottom (looking up at net).
 * Positions are:
 * Team A: [P1, P2] / [P4, P3] (top-left, top-right, bottom-right, bottom-left)
 * Team B: [P3, P4] / [P2, P1] (top-left, top-right, bottom-left, bottom-right)
 */
export function getCourtPosition(team: "A" | "B", index: number): { row: number; col: number } {
  if (team === "A") {
    switch (index) {
      case 0: return { row: 0, col: 0 }; // P1 (top-left)
      case 1: return { row: 0, col: 1 }; // P2 (top-right)
      case 2: return { row: 1, col: 1 }; // P3 (bottom-right)
      case 3: return { row: 1, col: 0 }; // P4 (bottom-left)
      default: return { row: 0, col: 0 };
    }
  } else {
    switch (index) {
      case 0: return { row: 1, col: 1 }; // P1 (bottom-right)
      case 1: return { row: 1, col: 0 }; // P2 (bottom-left)
      case 2: return { row: 0, col: 0 }; // P3 (top-left)
      case 3: return { row: 0, col: 1 }; // P4 (top-right)
      default: return { row: 1, col: 1 };
    }
  }
}

/**
 * Determines whether a point resulted in a side-out.
 */
export function isSideOut(servingTeam: "A" | "B", scoringTeam: "A" | "B"): boolean {
  return servingTeam !== scoringTeam;
}

/**
 * Returns who serves the next rally.
 */
export function getNextServingTeam(servingTeam: "A" | "B", scoringTeam: "A" | "B"): "A" | "B" {
  return scoringTeam;
}

export interface ScoringState {
  scoreA: number;
  scoreB: number;
  servingTeam: "A" | "B";
  rosterA: string[];
  rosterB: string[];
}

/**
 * Applies a scoring event to the match state, handling score increment and side-out rotations.
 */
export function applyPointResult(state: ScoringState, scoringTeam: "A" | "B"): ScoringState {
  const nextRosterA = [...state.rosterA];
  const nextRosterB = [...state.rosterB];
  let nextScoreA = state.scoreA;
  let nextScoreB = state.scoreB;

  if (scoringTeam === "A") {
    nextScoreA += 1;
  } else {
    nextScoreB += 1;
  }

  const sideOut = isSideOut(state.servingTeam, scoringTeam);

  if (sideOut) {
    if (scoringTeam === "A") {
      const rotated = rotateClockwise(nextRosterA);
      nextRosterA.splice(0, nextRosterA.length, ...rotated);
    } else {
      const rotated = rotateClockwise(nextRosterB);
      nextRosterB.splice(0, nextRosterB.length, ...rotated);
    }
  }

  return {
    scoreA: nextScoreA,
    scoreB: nextScoreB,
    servingTeam: scoringTeam,
    rosterA: nextRosterA,
    rosterB: nextRosterB,
  };
}

/**
 * Checks if the match has been won based on point target and win-by-2 rule.
 */
export function isMatchWon(
  scoreA: number,
  scoreB: number,
  pointTarget: number
): { won: boolean; winner?: "A" | "B" } {
  if (scoreA >= pointTarget && scoreA - scoreB >= 2) {
    return { won: true, winner: "A" };
  }
  if (scoreB >= pointTarget && scoreB - scoreA >= 2) {
    return { won: true, winner: "B" };
  }
  return { won: false };
}

/**
 * Recomputes the score by counting point events.
 */
export function computeScoreFromEvents(events: MatchEvent[]): { scoreA: number; scoreB: number } {
  let scoreA = 0;
  let scoreB = 0;
  for (const event of events) {
    if (event.type === "point") {
      if (event.team === "A") scoreA++;
      else if (event.team === "B") scoreB++;
    }
  }
  return { scoreA, scoreB };
}

/**
 * Determines the current serving team based on the last event.
 */
export function getServingTeamFromEvents(events: MatchEvent[]): "A" | "B" {
  if (!events || events.length === 0) return "A";
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "point" && event.team) {
      return event.team;
    }
    if (event.type === "serve" && event.servingTeam) {
      return event.servingTeam;
    }
  }
  return "A";
}

/**
 * Helper to auto-generate a descriptive match label.
 */
export function generateMatchLabel(teamAName?: string, teamBName?: string): string {
  const nameA = teamAName && teamAName.trim() !== "" ? teamAName : "Team A";
  const nameB = teamBName && teamBName.trim() !== "" ? teamBName : "Team B";
  return `${nameA} vs ${nameB}`;
}
