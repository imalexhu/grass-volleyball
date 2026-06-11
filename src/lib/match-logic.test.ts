import { describe, it, expect } from "vitest";
import {
  generateJoinCode,
  isValidJoinCode,
  rotateClockwise,
  getCourtPosition,
  isSideOut,
  getNextServingTeam,
  applyPointResult,
  isMatchWon,
  computeScoreFromEvents,
  getServingTeamFromEvents,
  generateMatchLabel,
  ScoringState
} from "./match-logic";
import { MatchEvent } from "./types";

describe("Join Code Logic", () => {
  it("generates a 4-character string of uppercase letters, excluding I and O", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(4);
    expect(isValidJoinCode(code)).toBe(true);
    expect(code).not.toContain("I");
    expect(code).not.toContain("O");
  });

  it("produces different codes on consecutive calls", () => {
    const code1 = generateJoinCode();
    const code2 = generateJoinCode();
    expect(code1).not.toBe(code2);
  });

  it("validates join codes correctly", () => {
    expect(isValidJoinCode("BVKR")).toBe(true);
    expect(isValidJoinCode("bvkr")).toBe(false); // Lowercase invalid
    expect(isValidJoinCode("BVK")).toBe(false);  // Too short
    expect(isValidJoinCode("BVKRX")).toBe(false); // Too long
    expect(isValidJoinCode("BV4R")).toBe(false);  // Contains numbers
    expect(isValidJoinCode("BVIR")).toBe(false);  // Contains I
    expect(isValidJoinCode("BVOR")).toBe(false);  // Contains O
    expect(isValidJoinCode("")).toBe(false);      // Empty
  });
});

describe("Court Rotation Logic", () => {
  it("rotates roster clockwise: index 3 moves to index 0", () => {
    const roster = ["Cal", "Jay", "Alex", "Bec"];
    const rotated = rotateClockwise(roster);
    expect(rotated).toEqual(["Bec", "Cal", "Jay", "Alex"]);
  });

  it("handles double rotation correctly", () => {
    const roster = ["a", "b", "c", "d"];
    const rotatedOnce = rotateClockwise(roster);
    const rotatedTwice = rotateClockwise(rotatedOnce);
    expect(rotatedTwice).toEqual(["c", "d", "a", "b"]);
  });

  it("restores original roster after 4 rotations", () => {
    let roster = ["a", "b", "c", "d"];
    for (let i = 0; i < 4; i++) {
      roster = rotateClockwise(roster);
    }
    expect(roster).toEqual(["a", "b", "c", "d"]);
  });

  it("returns original array if length is not 4", () => {
    expect(rotateClockwise(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("Court Position Mapping", () => {
  it("maps Team A positions to correct row/col quadrants", () => {
    expect(getCourtPosition("A", 0)).toEqual({ row: 0, col: 0 }); // P1 (top-left)
    expect(getCourtPosition("A", 1)).toEqual({ row: 0, col: 1 }); // P2 (top-right)
    expect(getCourtPosition("A", 2)).toEqual({ row: 1, col: 1 }); // P3 (bottom-right)
    expect(getCourtPosition("A", 3)).toEqual({ row: 1, col: 0 }); // P4 (bottom-left)
  });

  it("maps Team B positions to correct row/col quadrants", () => {
    expect(getCourtPosition("B", 0)).toEqual({ row: 1, col: 1 }); // P1 (bottom-right)
    expect(getCourtPosition("B", 1)).toEqual({ row: 1, col: 0 }); // P2 (bottom-left)
    expect(getCourtPosition("B", 2)).toEqual({ row: 0, col: 0 }); // P3 (top-left)
    expect(getCourtPosition("B", 3)).toEqual({ row: 0, col: 1 }); // P4 (top-right)
  });
});

describe("Side-Out Detection", () => {
  it("detects side-out when receiving team scores", () => {
    expect(isSideOut("A", "A")).toBe(false);
    expect(isSideOut("A", "B")).toBe(true);
    expect(isSideOut("B", "B")).toBe(false);
    expect(isSideOut("B", "A")).toBe(true);
  });

  it("determines next serving team correctly", () => {
    expect(getNextServingTeam("A", "A")).toBe("A");
    expect(getNextServingTeam("A", "B")).toBe("B");
    expect(getNextServingTeam("B", "B")).toBe("B");
    expect(getNextServingTeam("B", "A")).toBe("A");
  });
});

describe("Point Application State Transition", () => {
  const initialState: ScoringState = {
    scoreA: 5,
    scoreB: 8,
    servingTeam: "A",
    rosterA: ["u1", "u2", "u3", "u4"],
    rosterB: ["v1", "v2", "v3", "v4"]
  };

  it("increments Team A score and does not rotate Team A if Team A was serving", () => {
    const nextState = applyPointResult(initialState, "A");
    expect(nextState.scoreA).toBe(6);
    expect(nextState.scoreB).toBe(8);
    expect(nextState.servingTeam).toBe("A");
    expect(nextState.rosterA).toEqual(["u1", "u2", "u3", "u4"]);
    expect(nextState.rosterB).toEqual(["v1", "v2", "v3", "v4"]);
  });

  it("increments Team B score and rotates Team B if Team B won point on A's serve (side-out)", () => {
    const nextState = applyPointResult(initialState, "B");
    expect(nextState.scoreA).toBe(5);
    expect(nextState.scoreB).toBe(9);
    expect(nextState.servingTeam).toBe("B");
    expect(nextState.rosterA).toEqual(["u1", "u2", "u3", "u4"]);
    // Team B rotates: [v1, v2, v3, v4] -> [v4, v1, v2, v3]
    expect(nextState.rosterB).toEqual(["v4", "v1", "v2", "v3"]);
  });
});

describe("Win Detection", () => {
  it("detects win when team reaches target and leads by 2", () => {
    expect(isMatchWon(21, 15, 21)).toEqual({ won: true, winner: "A" });
    expect(isMatchWon(18, 21, 21)).toEqual({ won: true, winner: "B" });
  });

  it("denies win if target is reached but not leading by 2", () => {
    expect(isMatchWon(21, 20, 21)).toEqual({ won: false });
    expect(isMatchWon(22, 21, 21)).toEqual({ won: false });
  });

  it("handles deuce resolution", () => {
    expect(isMatchWon(23, 21, 21)).toEqual({ won: true, winner: "A" });
    expect(isMatchWon(24, 26, 21)).toEqual({ won: true, winner: "B" });
  });

  it("handles alternative point targets", () => {
    expect(isMatchWon(15, 13, 15)).toEqual({ won: true, winner: "A" });
    expect(isMatchWon(5, 3, 5)).toEqual({ won: true, winner: "A" });
  });
});

describe("Score and Server Computation from Events", () => {
  const events: MatchEvent[] = [
    { id: "1", type: "serve", timestamp: 1000, scoreA: 0, scoreB: 0, servingTeam: "A" },
    { id: "2", type: "point", team: "A", timestamp: 2000, scoreA: 1, scoreB: 0 },
    { id: "3", type: "serve", timestamp: 3000, scoreA: 1, scoreB: 0, servingTeam: "A" },
    { id: "4", type: "point", team: "B", timestamp: 4000, scoreA: 1, scoreB: 1 },
    { id: "5", type: "serve", timestamp: 5000, scoreA: 1, scoreB: 1, servingTeam: "B" },
    { id: "6", type: "point", team: "B", timestamp: 6000, scoreA: 1, scoreB: 2 }
  ];

  it("computes scores correctly from event list", () => {
    expect(computeScoreFromEvents(events)).toEqual({ scoreA: 1, scoreB: 2 });
    expect(computeScoreFromEvents([])).toEqual({ scoreA: 0, scoreB: 0 });
  });

  it("gets the correct next serving team from event list", () => {
    expect(getServingTeamFromEvents(events)).toBe("B");
    expect(getServingTeamFromEvents([])).toBe("A"); // Default fallback
  });
});

describe("Match Label Auto-Generation", () => {
  it("combines custom names correctly", () => {
    expect(generateMatchLabel("Sharks", "Jets")).toBe("Sharks vs Jets");
  });

  it("uses fallbacks for empty names", () => {
    expect(generateMatchLabel("", "Jets")).toBe("Team A vs Jets");
    expect(generateMatchLabel("Sharks", "   ")).toBe("Sharks vs Team B");
    expect(generateMatchLabel()).toBe("Team A vs Team B");
  });
});
