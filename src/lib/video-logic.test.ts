import { describe, it, expect } from "vitest";
import {
  extractRallies,
  alignTimestamps,
  getHighlightPerspective
} from "./video-logic";
import { MatchEvent } from "./types";

describe("Rally Extraction Logic", () => {
  it("extracts complete rallies correctly", () => {
    const events: MatchEvent[] = [
      { id: "e1", type: "serve", timestamp: 10000, scoreA: 0, scoreB: 0, servingTeam: "A" },
      { id: "e2", type: "point", team: "A", timestamp: 25000, scoreA: 1, scoreB: 0 }
    ];
    const rallies = extractRallies(events);
    expect(rallies).toHaveLength(1);
    expect(rallies[0]).toEqual({
      id: "e2",
      serveTime: 10000,
      pointTime: 25000,
      scoringTeam: "A",
      servingTeam: "A",
      scoreA: 1,
      scoreB: 0,
      isHighlight: false,
      highlightPlayerId: undefined,
      highlightPlayerName: undefined
    });
  });

  it("handles multiple rallies and ignores trailing serves", () => {
    const events: MatchEvent[] = [
      { id: "e1", type: "serve", timestamp: 10000, scoreA: 0, scoreB: 0, servingTeam: "A" },
      { id: "e2", type: "point", team: "B", timestamp: 15000, scoreA: 0, scoreB: 1 },
      { id: "e3", type: "serve", timestamp: 20000, scoreA: 0, scoreB: 1, servingTeam: "B" } // trailing serve (no point)
    ];
    const rallies = extractRallies(events);
    expect(rallies).toHaveLength(1);
    expect(rallies[0].id).toBe("e2");
  });

  it("extracts highlight flag and player attribution", () => {
    const events: MatchEvent[] = [
      { id: "e1", type: "serve", timestamp: 10000, scoreA: 0, scoreB: 0, servingTeam: "A" },
      {
        id: "e2",
        type: "point",
        team: "A",
        timestamp: 15000,
        scoreA: 1,
        scoreB: 0,
        isHighlight: true,
        highlightPlayerId: "u123",
        highlightPlayerName: "Alex"
      }
    ];
    const rallies = extractRallies(events);
    expect(rallies[0].isHighlight).toBe(true);
    expect(rallies[0].highlightPlayerId).toBe("u123");
    expect(rallies[0].highlightPlayerName).toBe("Alex");
  });
});

describe("Timestamp Alignment Math", () => {
  it("aligns timestamps with video timeline using offset and padding", () => {
    const events: MatchEvent[] = [
      { id: "e1", type: "serve", timestamp: 10000, scoreA: 0, scoreB: 0, servingTeam: "A" },
      { id: "e2", type: "point", team: "A", timestamp: 30000, scoreA: 1, scoreB: 0 }
    ];
    const firstServe = 10000;
    const videoOffset = 135; // 135 seconds offset
    const clips = alignTimestamps(events, firstServe, videoOffset);

    expect(clips).toHaveLength(1);
    // serve diff = (10000 - 10000)/1000 = 0s
    // point diff = (30000 - 10000)/1000 = 20s
    // start = 135 + 0 - 2 = 133s
    // end = 135 + 20 + 2 = 157s
    expect(clips[0].start).toBe(133);
    expect(clips[0].end).toBe(157);
  });

  it("caps start time at 0 if offset is small", () => {
    const events: MatchEvent[] = [
      { id: "e1", type: "serve", timestamp: 10000, scoreA: 0, scoreB: 0, servingTeam: "A" },
      { id: "e2", type: "point", team: "A", timestamp: 11000, scoreA: 1, scoreB: 0 }
    ];
    const firstServe = 10000;
    const videoOffset = 1.0; // 1 second offset
    const clips = alignTimestamps(events, firstServe, videoOffset);
    // start = 1.0 + 0 - 2 = -1.0s -> max(0, -1) = 0s
    expect(clips[0].start).toBe(0);
    expect(clips[0].end).toBe(4); // 1.0 offset + 1.0 diff + 2.0 padding = 4.0s
  });
});

describe("Highlight Perspective Selection", () => {
  const rosterA = ["playerA1", "playerA2"];
  const rosterB = ["playerB1", "playerB2"];

  it("returns the only available perspective if only one is uploaded", () => {
    const event: MatchEvent = {
      id: "e1",
      type: "point",
      team: "A",
      timestamp: 15000,
      scoreA: 1,
      scoreB: 0,
      isHighlight: true,
      highlightPlayerId: "playerB1" // normally B, but B is not available
    };
    expect(getHighlightPerspective(event, rosterA, rosterB, ["A"])).toBe("A");
  });

  it("uses player's team perspective if both are available", () => {
    const eventA: MatchEvent = {
      id: "e1",
      type: "point",
      team: "B",
      timestamp: 15000,
      scoreA: 0,
      scoreB: 1,
      isHighlight: true,
      highlightPlayerId: "playerA2"
    };
    const eventB: MatchEvent = {
      id: "e2",
      type: "point",
      team: "A",
      timestamp: 16000,
      scoreA: 1,
      scoreB: 1,
      isHighlight: true,
      highlightPlayerId: "playerB1"
    };
    expect(getHighlightPerspective(eventA, rosterA, rosterB, ["A", "B"])).toBe("A");
    expect(getHighlightPerspective(eventB, rosterA, rosterB, ["A", "B"])).toBe("B");
  });

  it("falls back to scoring team perspective if no player is attributed", () => {
    const event: MatchEvent = {
      id: "e1",
      type: "point",
      team: "B",
      timestamp: 15000,
      scoreA: 0,
      scoreB: 1,
      isHighlight: true
    };
    expect(getHighlightPerspective(event, rosterA, rosterB, ["A", "B"])).toBe("B");
  });
});
