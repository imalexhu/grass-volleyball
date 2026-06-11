import { describe, it, expect } from "vitest";
import { computePlayerStats, computeTeamStats } from "./stats-logic";
import { Match } from "./types";

describe("Player Stats Computation", () => {
  const dummyPlayer = { userId: "p1", displayName: "Fardeen", joinedAt: 1000 };

  it("returns zeros if no matches are provided", () => {
    const stats = computePlayerStats("p1", []);
    expect(stats).toEqual({
      played: 0,
      won: 0,
      winPct: 0,
      highlights: 0,
      pointsPlayed: 0,
      hlRate: 0
    });
  });

  it("filters out incomplete matches", () => {
    const matches: Match[] = [
      {
        id: "m1",
        teamA: "teamA",
        teamB: "teamB",
        playersA: [dummyPlayer],
        status: "live",
        scoreA: 5,
        scoreB: 2,
        scheduledAt: ""
      }
    ];
    const stats = computePlayerStats("p1", matches);
    expect(stats.played).toBe(0);
  });

  it("calculates basic wins, losses, win percentage, and highlight rate", () => {
    const matches: Match[] = [
      {
        id: "m1",
        teamA: "teamA",
        teamB: "teamB",
        playersA: [dummyPlayer],
        activeRosterA: ["p1", "p2", "p3", "p4"],
        status: "complete",
        scoreA: 21,
        scoreB: 15,
        scheduledAt: "",
        events: [
          { id: "e1", type: "point", team: "A", timestamp: 1000, scoreA: 1, scoreB: 0, isHighlight: true, highlightPlayerId: "p1" },
          { id: "e2", type: "point", team: "B", timestamp: 2000, scoreA: 1, scoreB: 1 }
        ]
      },
      {
        id: "m2",
        teamA: "teamA",
        teamB: "teamB",
        playersB: [dummyPlayer],
        activeRosterB: ["p1", "p2", "p3", "p4"],
        status: "processed",
        scoreA: 21,
        scoreB: 19, // Team B lost
        scheduledAt: "",
        events: [
          { id: "e3", type: "point", team: "A", timestamp: 3000, scoreA: 1, scoreB: 0 }
        ]
      }
    ];

    const stats = computePlayerStats("p1", matches);
    // played: 2 matches (m1 completed, m2 processed)
    // won: 1 match (m1 won as player on Team A, m2 lost as player on Team B)
    // winPct: 50%
    expect(stats.played).toBe(2);
    expect(stats.won).toBe(1);
    expect(stats.winPct).toBe(50);

    // highlights: 1 (e1)
    // pointsPlayed: 3 points total across both matches where player was in roster (e1, e2, e3)
    // hlRate: (1 / 3) * 100 = 33%
    expect(stats.highlights).toBe(1);
    expect(stats.pointsPlayed).toBe(3);
    expect(stats.hlRate).toBe(33);
  });

  it("accounts for player substitutions using event-level rosters", () => {
    const matches: Match[] = [
      {
        id: "m1",
        teamA: "teamA",
        teamB: "teamB",
        playersA: [dummyPlayer],
        status: "complete",
        scoreA: 21,
        scoreB: 15,
        scheduledAt: "",
        events: [
          // p1 active
          { id: "e1", type: "point", team: "A", timestamp: 1000, scoreA: 1, scoreB: 0, rosterA: ["p1", "p2", "p3", "p4"], rosterB: [] },
          // p1 substituted out, so not in rosterA
          { id: "e2", type: "point", team: "B", timestamp: 2000, scoreA: 1, scoreB: 1, rosterA: ["p5", "p2", "p3", "p4"], rosterB: [] }
        ]
      }
    ];

    const stats = computePlayerStats("p1", matches);
    expect(stats.pointsPlayed).toBe(1); // Only e1, since rosterA in e2 does not contain p1
  });
});

describe("Team Stats Computation", () => {
  it("computes team wins, plays and win percentages correctly", () => {
    const matches: Match[] = [
      { id: "m1", teamA: "team_sharks", teamB: "team_jets", status: "complete", scoreA: 21, scoreB: 10, scheduledAt: "" }, // win for sharks
      { id: "m2", teamA: "team_jets", teamB: "team_sharks", status: "processed", scoreA: 21, scoreB: 19, scheduledAt: "" }, // win for jets (loss for sharks)
      { id: "m3", teamA: "team_sharks", teamB: "team_other", status: "live", scoreA: 5, scoreB: 0, scheduledAt: "" } // ignored, not complete
    ];

    const sharksStats = computeTeamStats("team_sharks", matches);
    expect(sharksStats.played).toBe(2);
    expect(sharksStats.won).toBe(1);
    expect(sharksStats.winPct).toBe(50);

    const jetsStats = computeTeamStats("team_jets", matches);
    expect(jetsStats.played).toBe(2);
    expect(jetsStats.won).toBe(1);
    expect(jetsStats.winPct).toBe(50);
  });
});
