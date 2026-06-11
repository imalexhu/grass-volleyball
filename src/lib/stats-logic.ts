import { Match } from "./types";

export interface PlayerStats {
  played: number;
  won: number;
  winPct: number;
  highlights: number;
  pointsPlayed: number;
  hlRate: number;
}

export interface TeamStats {
  played: number;
  won: number;
  winPct: number;
}

/**
 * Computes career stats for a player based on their match history.
 * Only processes complete or processed matches.
 */
export function computePlayerStats(userId: string, matches: Match[]): PlayerStats {
  let played = 0;
  let won = 0;
  let highlights = 0;
  let pointsPlayed = 0;

  if (!matches) {
    return { played: 0, won: 0, winPct: 0, highlights: 0, pointsPlayed: 0, hlRate: 0 };
  }

  for (const match of matches) {
    // Only count completed or processed matches
    if (match.status !== "complete" && match.status !== "processed") {
      continue;
    }

    const onTeamA = match.playersA?.some(p => p.userId === userId) || match.activeRosterA?.includes(userId);
    const onTeamB = match.playersB?.some(p => p.userId === userId) || match.activeRosterB?.includes(userId);

    if (!onTeamA && !onTeamB) {
      continue;
    }

    played++;

    const scoreA = match.scoreA || 0;
    const scoreB = match.scoreB || 0;
    const teamAWon = scoreA > scoreB;
    const teamBWon = scoreB > scoreA;

    if ((onTeamA && teamAWon) || (onTeamB && teamBWon)) {
      won++;
    }

    if (match.events) {
      for (const event of match.events) {
        if (event.type === "point") {
          // 1. Check if it was a highlight attributed to this player
          if (event.isHighlight && event.highlightPlayerId === userId) {
            highlights++;
          }

          // 2. Determine if the player was on court for this point
          if (event.rosterA && event.rosterB) {
            const activeOnA = event.rosterA.includes(userId);
            const activeOnB = event.rosterB.includes(userId);
            if (activeOnA || activeOnB) {
              pointsPlayed++;
            }
          } else {
            // Fallback: If no event-level rosters, check match active rosters
            const activeOnA = match.activeRosterA?.includes(userId);
            const activeOnB = match.activeRosterB?.includes(userId);
            if (activeOnA || activeOnB) {
              pointsPlayed++;
            }
          }
        }
      }
    }
  }

  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;
  const hlRate = pointsPlayed > 0 ? Math.round((highlights / pointsPlayed) * 100) : 0;

  return {
    played,
    won,
    winPct,
    highlights,
    pointsPlayed,
    hlRate
  };
}

/**
 * Computes stats for a team based on their match history.
 * Only processes complete or processed matches.
 */
export function computeTeamStats(teamId: string, matches: Match[]): TeamStats {
  let played = 0;
  let won = 0;

  if (!matches) {
    return { played: 0, won: 0, winPct: 0 };
  }

  for (const match of matches) {
    // Only count completed or processed matches
    if (match.status !== "complete" && match.status !== "processed") {
      continue;
    }

    const isTeamA = match.teamA === teamId;
    const isTeamB = match.teamB === teamId;

    if (!isTeamA && !isTeamB) {
      continue;
    }

    played++;

    const scoreA = match.scoreA || 0;
    const scoreB = match.scoreB || 0;
    const teamAWon = scoreA > scoreB;
    const teamBWon = scoreB > scoreA;

    if ((isTeamA && teamAWon) || (isTeamB && teamBWon)) {
      won++;
    }
  }

  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;

  return {
    played,
    won,
    winPct
  };
}
