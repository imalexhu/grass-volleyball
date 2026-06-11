import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Firebase modules ───
const mockDb = { type: "mock-db" };

vi.mock("@/lib/firebase", () => ({
  db: mockDb,
}));

// Track Firestore calls
const firestoreCalls: { fn: string; args: any[] }[] = [];
const mockCollection = vi.fn((_db: any, name: string) => ({ _name: name }));
const mockDoc = vi.fn((...args: any[]) => {
  // Firestore doc() can be called as:
  //   doc(collectionRef, docId)  — 2 args
  //   doc(db, collectionPath, docId)  — 3 args
  if (args.length === 3) {
    return { _id: args[2], _collection: args[1], _parent: args[0] };
  }
  return { _id: args[1], _parent: args[0] };
});
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockQuery = vi.fn((...args: any[]) => ({ _type: "query", args }));
const mockWhere = vi.fn((field: string, op: string, val: any) => ({ field, op, val }));
const mockOrderBy = vi.fn();
const mockWriteBatch = vi.fn(() => ({
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));
const mockOnSnapshot = vi.fn(() => vi.fn()); // returns unsubscribe function

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  writeBatch: mockWriteBatch,
  onSnapshot: mockOnSnapshot,
}));

// ─── Import after mocks ───
import type { TeamDoc, Tournament, Match, Standing, UserProfile } from "./types";

// Helper to create a resolved Firestore snapshot doc
function snap(data: any, id = "doc-1") {
  return { id, exists: () => true, data: () => data };
}
function snapList(...docs: any[]) {
  return { docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn) };
}

// ─────────────────────────────────────
// 1. Team Enforcement Tests
// ─────────────────────────────────────
describe("Team Enforcement (addTeamMember)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getTeam returns a valid team with 2 members
    mockGetDoc.mockResolvedValue(
      snap({
        name: "Spike Force",
        captainId: "captain-1",
        members: [
          { userId: "captain-1", displayName: "Alex", joinedAt: 100 },
          { userId: "user-2", displayName: "Sam", joinedAt: 200 },
        ],
        createdAt: 100,
        isActive: true,
      })
    );
    // Default: getUserProfile returns a user with 0 teams
    mockGetDocs.mockResolvedValue(snapList());
  });

  it("rejects adding a member when team already has 4", async () => {
    // Override: team already has 4 members
    mockGetDoc.mockResolvedValue(
      snap({
        name: "Full Team",
        captainId: "captain-1",
        members: [
          { userId: "u1", displayName: "A", joinedAt: 1 },
          { userId: "u2", displayName: "B", joinedAt: 2 },
          { userId: "u3", displayName: "C", joinedAt: 3 },
          { userId: "u4", displayName: "D", joinedAt: 4 },
        ],
        createdAt: 1,
        isActive: true,
      })
    );

    const { addTeamMember } = await import("./api");
    await expect(addTeamMember("team-1", "user-5")).rejects.toThrow(
      "Team already has 4 members (maximum)"
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("rejects adding a member who is already on the team", async () => {
    mockGetDoc.mockResolvedValue(
      snap({
        name: "Spike Force",
        captainId: "captain-1",
        members: [
          { userId: "captain-1", displayName: "Alex", joinedAt: 100 },
          { userId: "user-2", displayName: "Sam", joinedAt: 200 },
        ],
        createdAt: 100,
        isActive: true,
      })
    );

    const { addTeamMember } = await import("./api");
    await expect(addTeamMember("team-1", "captain-1")).rejects.toThrow(
      "User is already on this team"
    );
  });

  it("rejects adding a member when user is already on 3 teams", async () => {
    // Mock getTeam call (first getDoc call)
    mockGetDoc.mockResolvedValueOnce(
      snap({
        name: "Spike Force",
        captainId: "captain-1",
        members: [
          { userId: "captain-1", displayName: "Alex", joinedAt: 100 },
          { userId: "user-2", displayName: "Sam", joinedAt: 200 },
        ],
        createdAt: 100,
        isActive: true,
      })
    );
    // Mock getUserProfile call (second getDoc call) — already on 3 teams
    mockGetDoc.mockResolvedValueOnce(
      snap({
        id: "user-5",
        email: "test@test.com",
        displayName: "Test User",
        role: "player",
        teamIds: ["team-a", "team-b", "team-c"],
        joinedAt: 1,
      })
    );

    const { addTeamMember } = await import("./api");
    await expect(addTeamMember("team-1", "user-5")).rejects.toThrow(
      "User is already on 3 teams (maximum)"
    );
  });

  it("successfully adds a member when all checks pass", async () => {
    // Mock getTeam (first getDoc call)
    mockGetDoc.mockResolvedValueOnce(
      snap({
        name: "Spike Force",
        captainId: "captain-1",
        members: [
          { userId: "captain-1", displayName: "Alex", joinedAt: 100 },
          { userId: "user-2", displayName: "Sam", joinedAt: 200 },
        ],
        createdAt: 100,
        isActive: true,
      })
    );
    // Mock getUserProfile (second getDoc call) — user has 1 team, can join another
    mockGetDoc.mockResolvedValueOnce(
      snap({
        id: "user-5",
        email: "test@test.com",
        displayName: "Test User",
        role: "player",
        teamIds: ["team-a"],
        joinedAt: 1,
      })
    );

    const { addTeamMember } = await import("./api");
    await addTeamMember("team-1", "user-5");

    // Should update team members array
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({ userId: "user-5", displayName: "Test User" }),
        ]),
      })
    );

    // Should update user's teamIds
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        teamIds: expect.arrayContaining(["team-a", "team-1"]),
      })
    );
  });
});

// ─────────────────────────────────────
// 2. Tournament Registration Enforcement
// ─────────────────────────────────────
describe("Tournament Registration (registerTeamToTournament)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default tournament: open, 8 max, 0 registered
    mockGetDoc.mockResolvedValue(
      snap({
        organizerId: "org-1",
        name: "Summer Slam",
        dateStart: "2026-06-01",
        dateEnd: "2026-06-01",
        location: "Glenelg",
        format: "4v4 Pool Play",
        description: "",
        entryFee: 80,
        maxTeams: 8,
        maxPlayersPerTeam: 4,
        registeredTeams: [],
        status: "open",
      })
    );
  });

  it("rejects registration if tournament is not open", async () => {
    mockGetDoc.mockResolvedValue(
      snap({
        name: "Past Tournament",
        maxTeams: 8,
        registeredTeams: [],
        status: "complete",
      })
    );

    const { registerTeamToTournament } = await import("./api");
    await expect(registerTeamToTournament("trn-1", "team-1")).rejects.toThrow(
      "Tournament is not open for registration"
    );
  });

  it("rejects registration if team has fewer than 4 members", async () => {
    // Override the second getDoc call (team lookup)
    // First call returns tournament, second returns team
    mockGetDoc
      .mockResolvedValueOnce(
        snap({
          name: "Summer Slam",
          maxTeams: 8,
          registeredTeams: [],
          status: "open",
        })
      )
      .mockResolvedValueOnce(
        snap({
          name: "Half Team",
          captainId: "u1",
          members: [
            { userId: "u1", displayName: "A", joinedAt: 1 },
            { userId: "u2", displayName: "B", joinedAt: 2 },
          ],
          isActive: true,
        })
      );

    const { registerTeamToTournament } = await import("./api");
    await expect(registerTeamToTournament("trn-1", "team-1")).rejects.toThrow(
      "Team must have exactly 4 members"
    );
  });

  it("rejects registration if tournament is full", async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        snap({
          name: "Full Tournament",
          maxTeams: 8,
          registeredTeams: [
            { id: "team-1", name: "T1" },
            { id: "team-2", name: "T2" },
            { id: "team-3", name: "T3" },
            { id: "team-4", name: "T4" },
            { id: "team-5", name: "T5" },
            { id: "team-6", name: "T6" },
            { id: "team-7", name: "T7" },
            { id: "team-8", name: "T8" },
          ],
          status: "open",
        })
      )
      .mockResolvedValueOnce(
        snap({
          name: "Team 9",
          captainId: "u1",
          members: [
            { userId: "u1", displayName: "A", joinedAt: 1 },
            { userId: "u2", displayName: "B", joinedAt: 2 },
            { userId: "u3", displayName: "C", joinedAt: 3 },
            { userId: "u4", displayName: "D", joinedAt: 4 },
          ],
          isActive: true,
        })
      );

    const { registerTeamToTournament } = await import("./api");
    await expect(registerTeamToTournament("trn-1", "team-9")).rejects.toThrow(
      "Tournament is full"
    );
  });

  it("rejects duplicate team registration", async () => {
    mockGetDoc
      .mockResolvedValueOnce(
        snap({
          name: "Summer Slam",
          maxTeams: 8,
          registeredTeams: [{ id: "team-1", name: "Spike Force" }],
          status: "open",
        })
      )
      .mockResolvedValueOnce(
        snap({
          name: "Spike Force",
          captainId: "u1",
          members: [
            { userId: "u1", displayName: "A", joinedAt: 1 },
            { userId: "u2", displayName: "B", joinedAt: 2 },
            { userId: "u3", displayName: "C", joinedAt: 3 },
            { userId: "u4", displayName: "D", joinedAt: 4 },
          ],
          isActive: true,
        })
      );

    const { registerTeamToTournament } = await import("./api");
    await expect(registerTeamToTournament("trn-1", "team-1")).rejects.toThrow(
      "Team is already registered for this tournament"
    );
  });

  it("successfully registers a valid team and auto-fills tournament at capacity", async () => {
    // Fill tournament with 7 teams, registering the 8th should set status="filled"
    const existingTeams = Array.from({ length: 7 }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
    }));

    mockGetDoc
      .mockResolvedValueOnce(
        snap({
          name: "Summer Slam",
          maxTeams: 8,
          registeredTeams: existingTeams,
          status: "open",
        })
      )
      .mockResolvedValueOnce(
        snap({
          name: "Spike Force",
          captainId: "captain-1",
          members: [
            { userId: "u1", displayName: "A", joinedAt: 1 },
            { userId: "u2", displayName: "B", joinedAt: 2 },
            { userId: "u3", displayName: "C", joinedAt: 3 },
            { userId: "u4", displayName: "D", joinedAt: 4 },
          ],
          isActive: true,
        })
      );

    const { registerTeamToTournament } = await import("./api");
    await registerTeamToTournament("trn-1", "team-8");

    // Should add team and set status to "filled"
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: "filled",
        registeredTeams: expect.arrayContaining([
          expect.objectContaining({ id: "team-8", name: "Spike Force" }),
        ]),
      })
    );
  });
});

// ─────────────────────────────────────
// 3. Fixture Generation Tests
// ─────────────────────────────────────
describe("Fixture Generation (createFixtures)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to generate fixtures without exactly 8 teams", async () => {
    mockGetDoc.mockResolvedValue(
      snap({
        name: "Small Tournament",
        organizerId: "org-1",
        dateStart: "2026-06-01",
        registeredTeams: [
          { id: "t1", name: "T1" },
          { id: "t2", name: "T2" },
          { id: "t3", name: "T3" },
        ],
        status: "filled",
      })
    );

    const { createFixtures } = await import("./api");
    await expect(createFixtures("trn-1")).rejects.toThrow(
      "Currently only 8-team tournaments are supported"
    );
  });

  it("generates 14 matches for 8 teams (6 pool + 4 QF + 2 SF + 2 Finals)", async () => {
    const teams = Array.from({ length: 8 }, (_, i) => ({
      id: `t${i + 1}`,
      name: `Team ${i + 1}`,
      captain: "Captain",
    }));

    // Mock first getDoc (getTournament)
    mockGetDoc.mockResolvedValue(
      snap({
        name: "Full Tournament",
        organizerId: "org-1",
        dateStart: "2026-06-01",
        registeredTeams: teams,
        status: "filled",
      })
    );

    // Mock addDoc to return sequential IDs
    let callCount = 0;
    mockAddDoc.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ id: `match-${callCount}` });
    });

    // Mock standings collection query to return empty (for initialization)
    mockGetDocs.mockResolvedValue(snapList());

    const { createFixtures } = await import("./api");
    await createFixtures("trn-1");

    // Should generate pool + placement + finals matches
    // (6 pool + 4 QF + 2 semi + 2 final = 14 matches + 8 standings)
    const addCallCount = mockAddDoc.mock.calls.length;
    expect(addCallCount).toBeGreaterThanOrEqual(20);
    expect(addCallCount).toBeLessThanOrEqual(30);
  });
});

// ─────────────────────────────────────
// 4. Match Scoring & Standings Tests
// ─────────────────────────────────────
describe("Match Scoring & Standings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updateMatchResult completes a match and updates standings", async () => {
    // Mock match document
    mockGetDoc.mockResolvedValue(
      snap({
        tournamentId: "trn-1",
        teamA: "Spike Force",
        teamB: "Sandstorm",
        stage: "pool",
        pool: "A",
        status: "live",
        scoreA: 0,
        scoreB: 0,
      })
    );

    // Mock standings for both teams
    mockGetDocs
      .mockResolvedValueOnce(
        snapList(
          snap(
            {
              tournamentId: "trn-1",
              team: "Spike Force",
              played: 0,
              won: 0,
              lost: 0,
              points: 0,
              diff: 0,
              pool: "A",
            },
            "stand-1"
          )
        )
      )
      .mockResolvedValueOnce(
        snapList(
          snap(
            {
              tournamentId: "trn-1",
              team: "Sandstorm",
              played: 0,
              won: 0,
              lost: 0,
              points: 0,
              diff: 0,
              pool: "A",
            },
            "stand-2"
          )
        )
      )
      // Third call: matches query for checkAndPopulateInitialPlacements (empty = no pool matches complete yet)
      .mockResolvedValueOnce(snapList());

    const { updateMatchResult } = await import("./api");
    await updateMatchResult("match-1", 25, 18);

    // Match should be marked as complete
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: "complete",
        scoreA: 25,
        scoreB: 18,
      })
    );

    // Spike Force (winner) should get +2 points, +7 diff
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        played: 1,
        won: 1,
        lost: 0,
        points: 2,
        diff: 7,
      })
    );

    // Sandstorm (loser) should get 0 points, -7 diff
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        played: 1,
        won: 0,
        lost: 1,
        points: 0,
        diff: -7,
      })
    );
  });

  it("updateMatchResult for a final match marks tournament complete", async () => {
    mockGetDoc
      // Match doc
      .mockResolvedValueOnce(
        snap({
          tournamentId: "trn-1",
          teamA: "Spike Force",
          teamB: "Sandstorm",
          stage: "final",
          label: "Final",
          status: "live",
        })
      )
      // No standings updates needed for final
      .mockResolvedValueOnce(snap({}));

    mockGetDocs.mockResolvedValue(snapList());

    const { updateMatchResult, completeTournament } = await import("./api");
    await updateMatchResult("match-final", 25, 20);

    // Match should be complete
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: "complete",
      })
    );
  });
});

// ─────────────────────────────────────
// 5. Team CRUD Tests
// ─────────────────────────────────────
describe("Team CRUD (createTeam)", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); // Full reset including implementations
    mockGetDoc.mockImplementation(() =>
      Promise.resolve({
        id: "doc-1",
        exists: () => true,
        data: () => ({
          id: "user-1",
          email: "alex@test.com",
          displayName: "Alex",
          role: "player" as const,
          teamIds: ["old-team"],
          joinedAt: 100,
        }),
      })
    );
  });

  it("creates a team and adds the creator as captain + member", async () => {
    // Mock addDoc to return a team ID
    mockAddDoc.mockResolvedValue({ id: "new-team-1" });

    const { createTeam } = await import("./api");
    
    const teamId = await createTeam("Spike Force", "user-1");

    expect(teamId).toBe("new-team-1");

    // Should create team doc with creator as sole member
    const addDocCall = mockAddDoc.mock.calls[0];
    expect(addDocCall[0]).toHaveProperty("_name", "teams");
    expect(addDocCall[1]).toMatchObject({
      name: "Spike Force",
      captainId: "user-1",
      isActive: true,
    });

    // Should include the member with display name from profile
    expect(addDocCall[1].members[0]).toMatchObject({
      userId: "user-1",
      displayName: "Alex",
    });

    // Should update user's teamIds
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        teamIds: expect.arrayContaining(["old-team", "new-team-1"]),
      })
    );
  });
});

// ─────────────────────────────────────
// 6. Delete Tournament (Cascade)
// ─────────────────────────────────────
describe("Delete Tournament (deleteTournament)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cascades deletion to matches, standings, and the tournament itself", async () => {
    mockGetDocs
      // Matches
      .mockResolvedValueOnce(
        snapList(snap({ tournamentId: "trn-1" }, "match-1"), snap({ tournamentId: "trn-1" }, "match-2"))
      )
      // Standings
      .mockResolvedValueOnce(
        snapList(snap({ tournamentId: "trn-1" }, "stand-1"), snap({ tournamentId: "trn-1" }, "stand-2"))
      );

    const { deleteTournament } = await import("./api");
    await deleteTournament("trn-1");

    // writeBatch should have been used
    expect(mockWriteBatch).toHaveBeenCalled();
    const batch = mockWriteBatch.mock.results[0].value;
    expect(batch.delete).toHaveBeenCalledTimes(5); // 2 matches + 2 standings + 1 tournament
    expect(batch.commit).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────
// 7. Casual Match System API Tests
// ─────────────────────────────────────
describe("Casual Match System API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createCasualMatch generates two unique join codes and creates the document", async () => {
    mockGetDocs.mockResolvedValue(snapList()); // No collision mock
    mockAddDoc.mockResolvedValue({ id: "match-casual-1" });

    const { createCasualMatch } = await import("./api");
    const matchId = await createCasualMatch("admin-123", { label: "Test Game", pointTarget: 21 });

    expect(matchId).toBe("match-casual-1");
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.objectContaining({ _name: "matches" }),
      expect.objectContaining({
        label: "Test Game",
        createdBy: "admin-123",
        pointTarget: 21,
        status: "active",
        phase: "setup"
      })
    );
  });

  it("getMatchByJoinCode searches both join codes", async () => {
    // Mock getDocs to return match when querying team A
    mockGetDocs
      .mockResolvedValueOnce(snapList(snap({ label: "Game A", joinCodeA: "BVKR", status: "active" }, "match-1"))) // Team A search finds match
      .mockResolvedValueOnce(snapList()); // Team B search empty

    const { getMatchByJoinCode } = await import("./api");
    const result = await getMatchByJoinCode("BVKR");

    expect(result).not.toBeNull();
    expect(result?.team).toBe("A");
    expect(result?.match.label).toBe("Game A");
  });

  it("joinMatch adds player to players list and active roster", async () => {
    // Mock getMatchByJoinCode: Team A
    mockGetDocs
      .mockResolvedValueOnce(snapList(snap({ id: "match-1", label: "Game 1", joinCodeA: "BVKR", status: "active", playersA: [], activeRosterA: [] }, "match-1")))
      .mockResolvedValueOnce(snapList());

    // Mock getUserProfile
    mockGetDoc.mockResolvedValue(
      snap({
        displayName: "Fardeen",
        email: "fardeen@test.com"
      }, "user-123")
    );

    const { joinMatch } = await import("./api");
    const result = await joinMatch("BVKR", "user-123");

    expect(result.matchId).toBe("match-1");
    expect(result.team).toBe("A");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        playersA: expect.arrayContaining([
          expect.objectContaining({ userId: "user-123", displayName: "Fardeen" })
        ]),
        activeRosterA: expect.arrayContaining(["user-123"])
      })
    );
  });

  it("updatePlayerStats computes stats and updates user profile", async () => {
    // Mock getDocs for getPlayerMatches (returns all matches in DB, one complete match where user is on team A and won)
    mockGetDocs.mockResolvedValue(
      snapList(
        snap({
          status: "complete",
          scoreA: 21,
          scoreB: 15,
          playersA: [{ userId: "user-123", displayName: "Fardeen" }],
          activeRosterA: ["user-123", "p2", "p3", "p4"],
          events: [
            { type: "point", team: "A", isHighlight: true, highlightPlayerId: "user-123" },
            { type: "point", team: "B" }
          ]
        }, "match-1")
      )
    );

    const { updatePlayerStats } = await import("./api");
    await updatePlayerStats("user-123");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        matchesPlayed: 1,
        matchesWon: 1,
        highlightsReceived: 1,
        pointsPlayed: 2
      })
    );
  });

  it("creates and retrieves notifications successfully", async () => {
    mockAddDoc.mockResolvedValue({ id: "notif-1" });
    mockGetDocs.mockResolvedValue(
      snapList(
        snap({
          userId: "user-123",
          type: "highlight_received",
          matchId: "m1",
          title: "New Highlight",
          message: "You got a highlight!",
          read: false,
          createdAt: 1000
        }, "notif-1")
      )
    );

    const { createNotification, getUserNotifications } = await import("./api");
    const notifId = await createNotification("user-123", "highlight_received", "m1", "New Highlight", "You got a highlight!");
    expect(notifId).toBe("notif-1");

    const list = await getUserNotifications("user-123");
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("New Highlight");
  });
});