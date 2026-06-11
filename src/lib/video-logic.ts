import { MatchEvent } from "./types";

export interface Rally {
  id: string;
  serveTime: number; // absolute timestamp
  pointTime: number; // absolute timestamp
  scoringTeam: "A" | "B";
  servingTeam: "A" | "B";
  scoreA: number;
  scoreB: number;
  isHighlight?: boolean;
  highlightPlayerId?: string;
  highlightPlayerName?: string;
}

export interface AlignedClip {
  id: string;
  start: number; // video-relative seconds
  end: number;   // video-relative seconds
  isHighlight: boolean;
  highlightPlayerId?: string;
  highlightPlayerName?: string;
  scoringTeam: "A" | "B";
  servingTeam: "A" | "B";
}

/**
 * Pairs up "serve" events with their following "point" events to extract rallies.
 * Rallies that are incomplete (e.g. have a serve but no point) are excluded.
 */
export function extractRallies(events: MatchEvent[]): Rally[] {
  const rallies: Rally[] = [];
  let currentServe: MatchEvent | null = null;

  if (!events) return rallies;

  for (const event of events) {
    if (event.type === "serve") {
      currentServe = event;
    } else if (event.type === "point" && currentServe) {
      rallies.push({
        id: event.id,
        serveTime: currentServe.timestamp,
        pointTime: event.timestamp,
        scoringTeam: event.team || "A",
        servingTeam: currentServe.servingTeam || "A",
        scoreA: event.scoreA,
        scoreB: event.scoreB,
        isHighlight: !!event.isHighlight,
        highlightPlayerId: event.highlightPlayerId,
        highlightPlayerName: event.highlightPlayerName,
      });
      currentServe = null; // reset
    }
  }

  return rallies;
}

/**
 * Aligns absolute match event timestamps with a raw video's timeline based on a sync anchor
 * (the first serve event and its known offset in the video). Adds a 2-second buffer
 * before the serve and a 2-second buffer after the point.
 */
export function alignTimestamps(
  events: MatchEvent[],
  firstServeTimestamp: number,
  videoOffsetSeconds: number
): AlignedClip[] {
  const rallies = extractRallies(events);
  const clips: AlignedClip[] = [];

  for (const rally of rallies) {
    const serveDiff = (rally.serveTime - firstServeTimestamp) / 1000;
    const pointDiff = (rally.pointTime - firstServeTimestamp) / 1000;

    const start = Math.max(0, videoOffsetSeconds + serveDiff - 2);
    const end = videoOffsetSeconds + pointDiff + 2;

    clips.push({
      id: rally.id,
      start,
      end,
      isHighlight: !!rally.isHighlight,
      highlightPlayerId: rally.highlightPlayerId,
      highlightPlayerName: rally.highlightPlayerName,
      scoringTeam: rally.scoringTeam,
      servingTeam: rally.servingTeam,
    });
  }

  return clips;
}

/**
 * Determines which camera perspective ("A" or "B") should be used for a highlight clip.
 * Follows the rules:
 * 1. If only 1 perspective is available, return that one immediately.
 * 2. If the highlight is attributed to a player, use that player's team's perspective.
 * 3. Otherwise (match highlight), use the scoring team's perspective.
 */
export function getHighlightPerspective(
  event: MatchEvent,
  activeRosterA: string[],
  activeRosterB: string[],
  availablePerspectives: ("A" | "B")[] = ["A", "B"]
): "A" | "B" {
  if (!availablePerspectives || availablePerspectives.length === 0) {
    return "A";
  }
  if (availablePerspectives.length === 1) {
    return availablePerspectives[0];
  }

  if (event.highlightPlayerId) {
    if (activeRosterA && activeRosterA.includes(event.highlightPlayerId)) {
      return "A";
    }
    if (activeRosterB && activeRosterB.includes(event.highlightPlayerId)) {
      return "B";
    }
  }

  return event.team || "A";
}
