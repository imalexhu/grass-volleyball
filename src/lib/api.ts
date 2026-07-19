import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Tournament, Match, Standing, Team, MatchEvent, VideoProcessingJob, UserProfile, TeamDoc, TeamMember, RegisteredTeam, MatchPlayer, UserNotification } from "./types";

// Collections
export const usersCollection = collection(db, "users");
export const tournamentsCollection = collection(db, "tournaments");
export const matchesCollection = collection(db, "matches");
export const standingsCollection = collection(db, "standings");
export const teamsCollection = collection(db, "teams");

// Tournaments
export const getTournaments = async (): Promise<Tournament[]> => {
  const q = query(tournamentsCollection, orderBy("dateStart", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Tournament);
};

export const getTournament = async (id: string): Promise<Tournament | null> => {
  const docRef = doc(db, "tournaments", id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Tournament;
  }
  return null;
};

// Users
export const getUserProfile = async (id: string): Promise<UserProfile | null> => {
  const docRef = doc(db, "users", id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as UserProfile;
  }
  return null;
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  const docRef = doc(db, "users", profile.id);
  await setDoc(docRef, sanitizeData(profile));
};

// Helper to strip undefined values for Firestore
const sanitizeData = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeData);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitizeData(v)])
    );
  }
  return obj;
};

export const createTournament = async (tournament: Omit<Tournament, "id">): Promise<string> => {
  const docRef = await addDoc(tournamentsCollection, tournament);
  return docRef.id;
};

export const updateTournament = async (id: string, data: Partial<Tournament>): Promise<void> => {
  const docRef = doc(db, "tournaments", id);
  await updateDoc(docRef, data);
};

export const deleteTournament = async (id: string): Promise<void> => {
  const batch = writeBatch(db);

  // 1. Delete all matches associated with this tournament
  const matchesQ = query(matchesCollection, where("tournamentId", "==", id));
  const matchesSnapshot = await getDocs(matchesQ);
  matchesSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // 2. Delete all standings associated with this tournament
  const standingsQ = query(standingsCollection, where("tournamentId", "==", id));
  const standingsSnapshot = await getDocs(standingsQ);
  standingsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // 3. Delete the tournament itself
  const tournamentRef = doc(db, "tournaments", id);
  batch.delete(tournamentRef);

  await batch.commit();
};

export const createFixtures = async (tournamentId: string): Promise<void> => {
  console.log("Creating fixtures for tournament:", tournamentId);
  try {
    const tournament = await getTournament(tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    const teams = [...(tournament.registeredTeams || [])];
    if (teams.length !== 8) throw new Error("Currently only 8-team tournaments are supported for auto-generation");

    console.log("Shuffling teams...");
    // Shuffle teams for random pool splitting
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }

    const poolA = teams.slice(0, 4);
    const poolB = teams.slice(4, 8);
    console.log("Pool A:", poolA.map(t => t.name));
    console.log("Pool B:", poolB.map(t => t.name));

    const matches: Omit<Match, "id">[] = [];
    const startTime = new Date(tournament.dateStart);
    startTime.setHours(9, 0, 0, 0); // Start at 9 AM

    const addTime = (minutes: number) => {
      startTime.setMinutes(startTime.getMinutes() + minutes);
      return startTime.toISOString();
    };

    // 1. Generate Round Robin for Pool A and B
    // Each pool has 6 matches. We can run them in parallel on 2 courts.
    // Match 1: A1 vs A2 (C1), B1 vs B2 (C2)
    // Match 2: A3 vs A4 (C1), B3 vs B4 (C2)
    // ... and so on
    const poolPairings = [
      [0, 1], [2, 3], // Round 1
      [0, 2], [1, 3], // Round 2
      [0, 3], [1, 2]  // Round 3
    ];

    poolPairings.forEach((pair, roundIdx) => {
      const time = addTime(30); // 30 mins per set
      // Pool A
      matches.push({
        tournamentId,
        organizerId: tournament.organizerId,
        stage: "pool",
        pool: "A",
        teamA: poolA[pair[0]].name,
        teamB: poolA[pair[1]].name,
        court: 1,
        scheduledAt: time,
        status: "scheduled",
      });
      // Pool B
      matches.push({
        tournamentId,
        organizerId: tournament.organizerId,
        stage: "pool",
        pool: "B",
        teamA: poolB[pair[0]].name,
        teamB: poolB[pair[1]].name,
        court: 2,
        scheduledAt: time,
        status: "scheduled",
      });
    });

    // 2. Placement Rounds (Placeholders)
    // Quarter-finals style: A1 vs B4, A2 vs B3, A3 vs B2, A4 vs B1
    const qfTime = addTime(45);
    const placementPairs = [
      { a: "Pool A 1st", b: "Pool B 4th", id: "QF1" },
      { a: "Pool A 2nd", b: "Pool B 3rd", id: "QF2" },
      { a: "Pool A 3rd", b: "Pool B 2nd", id: "QF3" },
      { a: "Pool A 4th", b: "Pool B 1st", id: "QF4" },
    ];

    placementPairs.forEach((p, i) => {
      matches.push({
        tournamentId,
        organizerId: tournament.organizerId,
        stage: "placement",
        teamA: p.a,
        teamB: p.b,
        court: (i % 2) + 1,
        scheduledAt: qfTime,
        status: "scheduled",
        label: p.id
      });
    });

    // Semis
    const semiTime = addTime(45);
    matches.push({
      tournamentId,
      organizerId: tournament.organizerId,
      stage: "placement",
      teamA: "Winner of QF1",
      teamB: "Winner of QF4",
      court: 1,
      scheduledAt: semiTime,
      status: "scheduled",
      label: "Semi 1"
    });
    matches.push({
      tournamentId,
      organizerId: tournament.organizerId,
      stage: "placement",
      teamA: "Winner of QF2",
      teamB: "Winner of QF3",
      court: 2,
      scheduledAt: semiTime,
      status: "scheduled",
      label: "Semi 2"
    });

    // Finals
    const finalTime = addTime(45);
    matches.push({
      tournamentId,
      organizerId: tournament.organizerId,
      stage: "final",
      teamA: "Winner of Semi 1",
      teamB: "Winner of Semi 2",
      court: 1,
      scheduledAt: finalTime,
      status: "scheduled",
      label: "Final"
    });
    matches.push({
      tournamentId,
      organizerId: tournament.organizerId,
      stage: "final",
      teamA: "Loser of Semi 1",
      teamB: "Loser of Semi 2",
      court: 2,
      scheduledAt: finalTime,
      status: "scheduled",
      label: "Bronze"
    });

    // Save matches to Firestore
    console.log(`Saving ${matches.length} matches...`);
    for (const match of matches) {
      await addDoc(matchesCollection, match);
    }

    // Initialize standings
    console.log("Initializing standings...");
    const allTeams = [...poolA, ...poolB];
    for (const team of allTeams) {
      await addDoc(standingsCollection, {
        tournamentId,
        team: team.name,
        rank: 0,
        played: 0,
        won: 0,
        lost: 0,
        points: 0,
        diff: 0,
        pool: poolA.includes(team) ? "A" : "B"
      });
    }
    console.log("Fixtures and standings created successfully!");
  } catch (error) {
    console.error("Error creating fixtures:", error);
    throw error;
  }
};

export const createTestTournamentWithTeams = async (organizerId: string = "org-1"): Promise<string> => {
  const testTeams: Team[] = Array.from({ length: 8 }, (_, i) => ({
    id: `temp-${i + 1}`,
    name: `Team ${i + 1}`,
    captain: "—",
  }));

  const tournamentId = await createTournament({
    organizerId,
    name: "Test 8-Team Pro",
    dateStart: new Date().toISOString().split("T")[0],
    dateEnd: new Date().toISOString().split("T")[0],
    location: "City Beach",
    format: "Mixed 4s",
    description: "A test tournament with 8 teams ready for fixture generation.",
    entryFee: 120,
    maxTeams: 8,
    maxPlayersPerTeam: 4,
    registeredTeams: testTeams,
    status: "filled",
  });

  return tournamentId;
};

export const completeTournament = async (id: string): Promise<void> => {
  await updateTournament(id, { status: "complete" });
};

export const createMatch = async (match: Omit<Match, "id">): Promise<string> => {
  const docRef = await addDoc(matchesCollection, match);
  return docRef.id;
};

// Matches
export const getMatches = async (tournamentId?: string): Promise<Match[]> => {
  let q = query(matchesCollection);
  if (tournamentId) {
    q = query(matchesCollection, where("tournamentId", "==", tournamentId));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
};

export const getMatch = async (id: string): Promise<Match | null> => {
  const docRef = doc(db, "matches", id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Match;
  }
  return null;
};

export const getMatchesByTeam = async (teamName: string): Promise<Match[]> => {
  // Firestore doesn't support OR queries directly without multiple queries or composite indexes
  const qA = query(matchesCollection, where("teamA", "==", teamName));
  const qB = query(matchesCollection, where("teamB", "==", teamName));
  const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
  
  const matchesMap = new Map<string, Match>();
  snapA.docs.forEach(doc => matchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match));
  snapB.docs.forEach(doc => matchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match));
  
  return Array.from(matchesMap.values());
};

export const getRunningMatches = async (): Promise<Match[]> => {
  const q = query(matchesCollection, where("status", "==", "live"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
};

export const subscribeToLiveMatches = (callback: (matches: Match[]) => void) => {
  const q = query(matchesCollection, where("status", "==", "live"));
  return onSnapshot(
    q,
    (snapshot) => {
      const matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
      callback(matches);
    },
    (error) => {
      console.error("Failed to subscribe to live matches:", error);
    }
  );
};

export const subscribeToMatch = (matchId: string, callback: (match: Match) => void) => {
  const docRef = doc(db, "matches", matchId);
  return onSnapshot(
    docRef,
    (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as Match);
      }
    },
    (error) => {
      console.error(`Failed to subscribe to match ${matchId}:`, error);
    }
  );
};

export const startMatch = async (matchId: string): Promise<void> => {
  const docRef = doc(db, "matches", matchId);
  await updateDoc(docRef, { 
    status: "live",
    currentSetScoreA: 0,
    currentSetScoreB: 0,
    events: []
  });
};

export const updateMatchLiveScore = async (
  matchId: string, 
  scoreA: number, 
  scoreB: number, 
  events: MatchEvent[]
): Promise<void> => {
  const docRef = doc(db, "matches", matchId);
  await updateDoc(docRef, sanitizeData({
    currentSetScoreA: scoreA,
    currentSetScoreB: scoreB,
    events: events
  }));
};

export const updateMatchEvents = async (matchId: string, events: MatchEvent[]): Promise<void> => {
  const docRef = doc(db, "matches", matchId);
  await updateDoc(docRef, sanitizeData({ events }));
};

export const updateMatchVideoUrl = async (matchId: string, url: string): Promise<void> => {
  const docRef = doc(db, "matches", matchId);
  await updateDoc(docRef, { matchHighlightsUrl: url });
};

export const getStandings = async (tournamentId: string): Promise<Standing[]> => {
  console.log("Fetching standings for:", tournamentId);
  // Remove orderBy from query to avoid index requirements, sort in memory instead
  const q = query(standingsCollection, where("tournamentId", "==", tournamentId));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Standing);

  // Sort by points desc, then diff desc
  return results.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.diff - a.diff;
  });
};

export const getStandingsByTeam = async (teamName: string): Promise<Standing[]> => {
  const q = query(standingsCollection, where("team", "==", teamName));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Standing);
};

export const getTeamInfo = async (teamName: string): Promise<RegisteredTeam | Team | null> => {
  // Find a tournament where this team is registered
  const snapshot = await getDocs(tournamentsCollection);
  for (const doc of snapshot.docs) {
    const data = doc.data() as Tournament;
    const team = data.registeredTeams?.find(t => t.name === teamName);
    if (team) {
      return team;
    }
  }
  return null;
};

// Additional helper functions can be added as needed

export const updateMatchResult = async (
  matchId: string,
  scoreA: number,
  scoreB: number,
  extras?: {
    vodUrlA?: string,
    vodUrlB?: string,
    matchHighlightsUrl?: string,
    events?: MatchEvent[]
  }
): Promise<void> => {
  console.log(`Updating match ${matchId} with score ${scoreA}-${scoreB}`);
  const matchRef = doc(matchesCollection, matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) throw new Error("Match not found");
  const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

  // 1. Update the match itself
  await updateDoc(matchRef, sanitizeData({
    scoreA,
    scoreB,
    status: "complete",
    currentSetScoreA: 0, // Reset live scores
    currentSetScoreB: 0,
    ...extras
  }));

  if (match.stage === "pool" && match.tournamentId) {
    // 2. Update standings
    await updateStandingsForMatch(match.tournamentId, match.teamA, match.teamB, scoreA, scoreB);

    // 3. Check if all pool matches are done to populate initial placement round
    await checkAndPopulateInitialPlacements(match.tournamentId);
  } else if (match.stage === "placement" || match.stage === "final") {
    // 4. Update next round placeholders
    if (match.tournamentId) {
      await updateNextRoundPlaceholders(match.tournamentId, match);
      
      // 5. Update final rankings if applicable
      await updateRankingsFromMatch(match.tournamentId, match, scoreA, scoreB);

      // 6. If this was the Final, mark tournament as complete
      if (match.stage === "final" && match.label === "Final") {
        await completeTournament(match.tournamentId);
      }
    }
  }
};

const updateStandingsForMatch = async (tournamentId: string, teamA: string, teamB: string, scoreA: number, scoreB: number) => {
  const qA = query(standingsCollection, where("tournamentId", "==", tournamentId), where("team", "==", teamA));
  const qB = query(standingsCollection, where("tournamentId", "==", tournamentId), where("team", "==", teamB));

  const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
  const standA = { id: snapA.docs[0].id, ...snapA.docs[0].data() } as Standing;
  const standB = { id: snapB.docs[0].id, ...snapB.docs[0].data() } as Standing;

  const winA = scoreA > scoreB;

  await updateDoc(doc(standingsCollection, standA.id), {
    played: standA.played + 1,
    won: winA ? standA.won + 1 : standA.won,
    lost: winA ? standA.lost : standA.lost + 1,
    points: standA.points + (winA ? 2 : 0), // 2 pts for win
    diff: standA.diff + (scoreA - scoreB)
  });

  await updateDoc(doc(standingsCollection, standB.id), {
    played: standB.played + 1,
    won: !winA ? standB.won + 1 : standB.won,
    lost: !winA ? standB.lost : standB.lost + 1,
    points: standB.points + (!winA ? 2 : 0),
    diff: standB.diff + (scoreB - scoreA)
  });
};

const checkAndPopulateInitialPlacements = async (tournamentId: string) => {
  const allMatches = await getMatches(tournamentId);
  const poolMatches = allMatches.filter(m => m.stage === "pool");
  const allPoolMatchesComplete = poolMatches.every(m => m.status === "complete");

  if (allPoolMatchesComplete) {
    const standings = await getStandings(tournamentId);
    const poolA = standings.filter(s => s.pool === "A");
    const poolB = standings.filter(s => s.pool === "B");

    // Update A1 vs B4, etc.
    const placements = allMatches.filter(m => m.stage === "placement");

    for (const m of placements) {
      let updatedA = m.teamA;
      let updatedB = m.teamB;

      if (m.teamA === "Pool A 1st") updatedA = poolA[0].team;
      if (m.teamA === "Pool A 2nd") updatedA = poolA[1].team;
      if (m.teamA === "Pool A 3rd") updatedA = poolA[2].team;
      if (m.teamA === "Pool A 4th") updatedA = poolA[3].team;

      if (m.teamB === "Pool B 1st") updatedB = poolB[0].team;
      if (m.teamB === "Pool B 2nd") updatedB = poolB[1].team;
      if (m.teamB === "Pool B 3rd") updatedB = poolB[2].team;
      if (m.teamB === "Pool B 4th") updatedB = poolB[3].team;

      if (updatedA !== m.teamA || updatedB !== m.teamB) {
        await updateDoc(doc(matchesCollection, m.id), { teamA: updatedA, teamB: updatedB });
      }
    }
  }
};

const updateNextRoundPlaceholders = async (tournamentId: string, completedMatch: Match) => {
  const allMatches = await getMatches(tournamentId);
  const winner = (completedMatch.scoreA || 0) > (completedMatch.scoreB || 0) ? completedMatch.teamA : completedMatch.teamB;
  const loser = (completedMatch.scoreA || 0) > (completedMatch.scoreB || 0) ? completedMatch.teamB : completedMatch.teamA;

  const label = completedMatch.label;
  if (!label) return;

  for (const m of allMatches) {
    let newA = m.teamA;
    let newB = m.teamB;
    let changed = false;

    // Check Winner placeholders
    const winnerLabel = `Winner of ${label}`;
    if (m.teamA === winnerLabel) { newA = winner; changed = true; }
    if (m.teamB === winnerLabel) { newB = winner; changed = true; }

    // Check Loser placeholders
    const loserLabel = `Loser of ${label}`;
    if (m.teamA === loserLabel) { newA = loser; changed = true; }
    if (m.teamB === loserLabel) { newB = loser; changed = true; }

    if (changed) {
      await updateDoc(doc(matchesCollection, m.id), { teamA: newA, teamB: newB });
    }
  }
};

const updateRankingsFromMatch = async (tournamentId: string, match: Match, scoreA: number, scoreB: number) => {
  const winner = scoreA > scoreB ? match.teamA : match.teamB;
  const loser = scoreA > scoreB ? match.teamB : match.teamA;

  if (match.stage === "final") {
    if (match.label === "Final") {
      await updateTeamRank(tournamentId, winner, 1);
      await updateTeamRank(tournamentId, loser, 2);
    } else if (match.label === "Bronze") {
      await updateTeamRank(tournamentId, winner, 3);
      await updateTeamRank(tournamentId, loser, 4);
    }
  } else if (match.stage === "placement") {
    // Logic for other placement matches can be added here
    // e.g. 5th/6th, 7th/8th
  }
};

const updateTeamRank = async (tournamentId: string, teamName: string, rank: number) => {
  const q = query(standingsCollection, where("tournamentId", "==", tournamentId), where("team", "==", teamName));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(doc(standingsCollection, snap.docs[0].id), { rank });
  }
};

export const clearAllData = async (): Promise<void> => {
  // Clear Tournaments
  const tSnapshot = await getDocs(tournamentsCollection);
  for (const document of tSnapshot.docs) {
    await deleteDoc(document.ref);
  }

  // Clear Matches
  const mSnapshot = await getDocs(matchesCollection);
  for (const document of mSnapshot.docs) {
    await deleteDoc(document.ref);
  }

  // Clear Standings
  const sSnapshot = await getDocs(standingsCollection);
  for (const document of sSnapshot.docs) {
    await deleteDoc(document.ref);
  }
};

// ─── Video Processing Jobs ───────────────────────────────────────────────────

const processingJobsCollection = collection(db, "processingJobs");

/** Create a new processing job in Firestore and return its ID. */
export const createProcessingJob = async (
  matchId: string,
  perspective: "A" | "B",
  rawStoragePath: string
): Promise<string> => {
  const now = Date.now();
  const job: Omit<VideoProcessingJob, "id"> = {
    matchId,
    perspective,
    rawStoragePath,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(processingJobsCollection, job);

  // Also embed a reference on the match document for easy UI subscription
  await updateDoc(doc(db, "matches", matchId), {
    [`processingJob`]: { id: docRef.id, status: "queued", progress: 0, perspective },
  });

  return docRef.id;
};

/** Subscribe to real-time updates for a processing job. */
export const subscribeToProcessingJob = (
  jobId: string,
  callback: (job: VideoProcessingJob) => void
) => {
  const docRef = doc(db, "processingJobs", jobId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as VideoProcessingJob);
      }
    },
    (error) => {
      console.error(`Failed to subscribe to processing job ${jobId}:`, error);
    }
  );
};

/** Trigger the Cloud Run processor via HTTP POST. */
export const triggerCloudRunProcessing = async (
  jobId: string,
  matchId: string,
  perspective: "A" | "B",
  rawStoragePath: string
): Promise<void> => {
  const url = import.meta.env.VITE_CLOUD_RUN_PROCESSOR_URL;
  if (!url) throw new Error("VITE_CLOUD_RUN_PROCESSOR_URL is not set in .env");

  const resp = await fetch(`${url}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, matchId, perspective, rawStoragePath }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Cloud Run error ${resp.status}: ${text}`);
  }
};

// ═══════════════════════════════
// Teams (first-class Firestore collection)
// ═══════════════════════════════

/** Create a new team. Creator becomes captain and sole member. */
export const createTeam = async (name: string, creatorUserId: string): Promise<string> => {
  const now = Date.now();
  const team: Omit<TeamDoc, "id"> = {
    name,
    captainId: creatorUserId,
    members: [{
      userId: creatorUserId,
      displayName: "",
      joinedAt: now,
    }],
    createdAt: now,
    isActive: true,
  };

  // Fetch creator's display name
  const creatorProfile = await getUserProfile(creatorUserId);
  if (creatorProfile) {
    team.members[0].displayName = creatorProfile.displayName || creatorProfile.email || "Unknown";
  }

  const docRef = await addDoc(teamsCollection, team);

  // Add teamId to creator's profile
  const userRef = doc(usersCollection, creatorUserId);
  await updateDoc(userRef, {
    teamIds: [...(creatorProfile?.teamIds || []), docRef.id],
  });

  return docRef.id;
};

/** Get a team by ID. */
export const getTeam = async (teamId: string): Promise<TeamDoc | null> => {
  const docRef = doc(teamsCollection, teamId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as TeamDoc;
  }
  return null;
};

/** Get all teams a user belongs to. */
export const getUserTeams = async (userId: string): Promise<TeamDoc[]> => {
  const profile = await getUserProfile(userId);
  if (!profile || !profile.teamIds.length) return [];

  const teams: TeamDoc[] = [];
  for (const teamId of profile.teamIds) {
    const team = await getTeam(teamId);
    if (team && team.isActive) {
      teams.push(team);
    }
  }
  return teams;
};

/** Add a member to a team. Enforces 4-player limit and 3-team-per-user limit. */
export const addTeamMember = async (teamId: string, userId: string): Promise<void> => {
  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found");
  if (!team.isActive) throw new Error("Team is no longer active");

  if (team.members.length >= 4) {
    throw new Error("Team already has 4 members (maximum)");
  }

  if (team.members.some(m => m.userId === userId)) {
    throw new Error("User is already on this team");
  }

  const userProfile = await getUserProfile(userId);
  if (!userProfile) throw new Error("User not found");
  if (userProfile.teamIds.length >= 3) {
    throw new Error("User is already on 3 teams (maximum)");
  }

  const displayName = userProfile.displayName || userProfile.email || "Unknown";

  const teamRef = doc(teamsCollection, teamId);
  await updateDoc(teamRef, {
    members: [...team.members, { userId, displayName, joinedAt: Date.now() }],
  });

  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    teamIds: [...userProfile.teamIds, teamId],
  });
};

/** Remove a member from a team. */
export const removeTeamMember = async (teamId: string, userId: string): Promise<void> => {
  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found");

  if (team.captainId === userId) {
    throw new Error("Cannot remove the captain. Transfer captaincy or disband the team first.");
  }

  const teamRef = doc(teamsCollection, teamId);
  await updateDoc(teamRef, {
    members: team.members.filter(m => m.userId !== userId),
  });

  const userProfile = await getUserProfile(userId);
  if (userProfile) {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, {
      teamIds: userProfile.teamIds.filter(id => id !== teamId),
    });
  }
};

/** Update team name. */
export const updateTeamName = async (teamId: string, name: string): Promise<void> => {
  const teamRef = doc(teamsCollection, teamId);
  await updateDoc(teamRef, { name });
};

/** Disband a team (soft delete). */
export const disbandTeam = async (teamId: string): Promise<void> => {
  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found");

  const teamRef = doc(teamsCollection, teamId);
  await updateDoc(teamRef, { isActive: false });

  for (const member of team.members) {
    const profile = await getUserProfile(member.userId);
    if (profile) {
      const userRef = doc(usersCollection, member.userId);
      await updateDoc(userRef, {
        teamIds: profile.teamIds.filter(id => id !== teamId),
      });
    }
  }
};

/** Search users by display name (for team member lookup). */
export const searchUsers = async (query: string): Promise<UserProfile[]> => {
  const snapshot = await getDocs(usersCollection);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
    .filter(u =>
      u.displayName?.toLowerCase().includes(query.toLowerCase()) ||
      u.email?.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 10);
};

// ═══════════════════════════════
// Tournament Team Registration (revised)
// ═══════════════════════════════

/** Register an entire team (all 4 members) to a tournament. */
export const registerTeamToTournament = async (tournamentId: string, teamId: string): Promise<void> => {
  const tournament = await getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "open") throw new Error("Tournament is not open for registration");

  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found");
  if (!team.isActive) throw new Error("Team is no longer active");

  if (team.members.length !== 4) {
    throw new Error(`Team must have exactly 4 members to register (currently ${team.members.length})`);
  }

  if (tournament.registeredTeams.length >= tournament.maxTeams) {
    throw new Error("Tournament is full");
  }

  if (tournament.registeredTeams.some(t => t.id === teamId)) {
    throw new Error("Team is already registered for this tournament");
  }

  // Check if any team member is already registered with another team in this tournament
  const memberIds = new Set(team.members.map(m => m.userId));
  for (const regTeam of tournament.registeredTeams) {
    if (regTeam.captainId && memberIds.has(regTeam.captainId)) {
      throw new Error("One or more team members are already registered with another team in this tournament");
    }
  }

  const registeredTeam: RegisteredTeam = {
    id: teamId,
    name: team.name,
    captainId: team.captainId,
    memberNames: team.members.map(m => m.displayName),
  };

  const updatedTeams = [...tournament.registeredTeams, registeredTeam];
  const updateData: Partial<Tournament> = { registeredTeams: updatedTeams };

  if (updatedTeams.length >= tournament.maxTeams) {
    updateData.status = "filled";
  }

  await updateTournament(tournamentId, updateData);
};

/** Get all teams registered for a tournament (fetches full TeamDoc for each). */
export const getTournamentTeams = async (tournamentId: string): Promise<TeamDoc[]> => {
  const tournament = await getTournament(tournamentId);
  if (!tournament) return [];

  const teams: TeamDoc[] = [];
  for (const reg of tournament.registeredTeams) {
    const team = await getTeam(reg.id);
    if (team) {
      teams.push(team);
    }
  }
  return teams;
};

// ═══════════════════════════════
// Casual Match System
// ═══════════════════════════════

import { generateJoinCode as rawGenerateJoinCode, rotateClockwise } from "./match-logic";
import { computePlayerStats } from "./stats-logic";

/** Generates a unique 4-character join code that doesn't collide with any active matches. */
export const generateJoinCode = async (): Promise<string> => {
  let code = rawGenerateJoinCode();
  let attempts = 0;
  while (attempts < 10) {
    const qA = query(matchesCollection, where("joinCodeA", "==", code));
    const qB = query(matchesCollection, where("joinCodeB", "==", code));
    const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
    if (snapA.empty && snapB.empty) {
      return code;
    }
    code = rawGenerateJoinCode();
    attempts++;
  }
  return code;
};

/** Creates a new casual match in setup phase with two unique join codes. */
export const createCasualMatch = async (
  adminId: string,
  config: { label: string; pointTarget: number; rosterSize?: number }
): Promise<string> => {
  const joinCodeA = await generateJoinCode();
  let joinCodeB = await generateJoinCode();
  while (joinCodeB === joinCodeA) {
    joinCodeB = await generateJoinCode();
  }

  const matchData: Omit<Match, "id"> = {
    label: config.label,
    createdBy: adminId,
    joinCodeA,
    joinCodeB,
    playersA: [],
    playersB: [],
    activeRosterA: [],
    activeRosterB: [],
    pointTarget: config.pointTarget,
    rosterSize: config.rosterSize || 4,
    status: "active",
    phase: "setup",
    servingTeam: "A",
    scoreA: 0,
    scoreB: 0,
    events: [],
    scheduledAt: new Date().toISOString(),
    createdAt: Date.now(),
    teamA: "Team A",
    teamB: "Team B",
  };

  const docRef = await addDoc(matchesCollection, sanitizeData(matchData));
  return docRef.id;
};

/** Creates a new rematch copy of a completed casual match, resetting state but retaining player configurations. */
export const createRematch = async (parentMatch: Match): Promise<string> => {
  const joinCodeA = await generateJoinCode();
  let joinCodeB = await generateJoinCode();
  while (joinCodeB === joinCodeA) {
    joinCodeB = await generateJoinCode();
  }

  let label = parentMatch.label || "Casual Match";
  if (!label.includes("Rematch")) {
    label = `${label} (Rematch)`;
  }

  const matchData: Omit<Match, "id"> = {
    label,
    createdBy: parentMatch.createdBy || "",
    joinCodeA,
    joinCodeB,
    playersA: parentMatch.playersA || [],
    playersB: parentMatch.playersB || [],
    activeRosterA: parentMatch.activeRosterA || [],
    activeRosterB: parentMatch.activeRosterB || [],
    pointTarget: parentMatch.pointTarget ?? 21,
    rosterSize: parentMatch.rosterSize || 4,
    status: "active",
    phase: "setup",
    servingTeam: "A",
    scoreA: 0,
    scoreB: 0,
    events: [],
    scheduledAt: new Date().toISOString(),
    createdAt: Date.now(),
    teamA: parentMatch.teamA || "Team A",
    teamB: parentMatch.teamB || "Team B",
    tournamentId: parentMatch.tournamentId || undefined,
    stage: parentMatch.stage || undefined,
    pool: parentMatch.pool || undefined,
    court: parentMatch.court || undefined,
  };

  const docRef = await addDoc(matchesCollection, sanitizeData(matchData));
  return docRef.id;
};

/** Finds an active match by join code and determines which team it corresponds to. */
export const getMatchByJoinCode = async (code: string): Promise<{ match: Match; team: "A" | "B" } | null> => {
  const upperCode = code.toUpperCase();
  const qA = query(matchesCollection, where("joinCodeA", "==", upperCode), where("status", "==", "active"));
  const qB = query(matchesCollection, where("joinCodeB", "==", upperCode), where("status", "==", "active"));
  
  const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
  
  if (!snapA.empty) {
    const doc = snapA.docs[0];
    return { match: { id: doc.id, ...doc.data() } as Match, team: "A" };
  }
  if (!snapB.empty) {
    const doc = snapB.docs[0];
    return { match: { id: doc.id, ...doc.data() } as Match, team: "B" };
  }
  return null;
};

/** Adds a player to a team inside an active match using a join code. */
export const joinMatch = async (joinCode: string, userId: string): Promise<{ matchId: string; team: "A" | "B" }> => {
  const result = await getMatchByJoinCode(joinCode);
  if (!result) {
    throw new Error("Invalid join code or match is not active.");
  }
  const { match, team } = result;

  const profile = await getUserProfile(userId);
  const displayName = profile?.displayName || profile?.email || "Anonymous Player";
  const photoURL = profile?.organizationLogo || undefined; // Fallback to logo or undefined

  const matchPlayer: MatchPlayer = {
    userId,
    displayName,
    joinedAt: Date.now(),
    photoURL
  };

  const matchRef = doc(db, "matches", match.id);
  
  if (team === "A") {
    const alreadyJoined = match.playersA?.some(p => p.userId === userId);
    if (!alreadyJoined) {
      const playersA = [...(match.playersA || []), matchPlayer];
      const activeRosterA = [...(match.activeRosterA || [])];
      const limit = match.rosterSize || 4;
      if (activeRosterA.length < limit && !activeRosterA.includes(userId)) {
        activeRosterA.push(userId);
      }
      await updateDoc(matchRef, sanitizeData({ playersA, activeRosterA }));
    }
  } else {
    const alreadyJoined = match.playersB?.some(p => p.userId === userId);
    if (!alreadyJoined) {
      const playersB = [...(match.playersB || []), matchPlayer];
      const activeRosterB = [...(match.activeRosterB || [])];
      const limit = match.rosterSize || 4;
      if (activeRosterB.length < limit && !activeRosterB.includes(userId)) {
        activeRosterB.push(userId);
      }
      await updateDoc(matchRef, sanitizeData({ playersB, activeRosterB }));
    }
  }

  return { matchId: match.id, team };
};

/** Updates the active player roster list for Team A or Team B. */
export const setActiveRoster = async (matchId: string, team: "A" | "B", userIds: string[]): Promise<void> => {
  const matchRef = doc(db, "matches", matchId);
  if (team === "A") {
    await updateDoc(matchRef, { activeRosterA: userIds });
  } else {
    await updateDoc(matchRef, { activeRosterB: userIds });
  }
};

/** Rotates Team A or Team B active roster clockwise. */
export const rotateTeam = async (matchId: string, team: "A" | "B"): Promise<void> => {
  const match = await getMatch(matchId);
  if (!match) throw new Error("Match not found");
  
  const matchRef = doc(db, "matches", matchId);
  if (team === "A") {
    const roster = match.activeRosterA || [];
    if (roster.length === 4) {
      await updateDoc(matchRef, { activeRosterA: rotateClockwise(roster) });
    }
  } else {
    const roster = match.activeRosterB || [];
    if (roster.length === 4) {
      await updateDoc(matchRef, { activeRosterB: rotateClockwise(roster) });
    }
  }
};

/** Gets all matches matching a specific status. */
export const getMatchesByStatus = async (
  status: "active" | "action_required" | "processed"
): Promise<Match[]> => {
  const q = query(matchesCollection, where("status", "==", status));
  const snap = await getDocs(q);
  const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Match);
  return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

/** Fetches all matches a player participated in (either joined as player or in roster). */
export const getPlayerMatches = async (userId: string): Promise<Match[]> => {
  const snap = await getDocs(matchesCollection);
  const results = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as Match)
    .filter(match => 
      match.playersA?.some(p => p.userId === userId) ||
      match.playersB?.some(p => p.userId === userId) ||
      match.activeRosterA?.includes(userId) ||
      match.activeRosterB?.includes(userId)
    );
  return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

/** Recomputes and updates career stats for a user. */
export const updatePlayerStats = async (userId: string): Promise<void> => {
  const matches = await getPlayerMatches(userId);
  const stats = computePlayerStats(userId, matches);
  
  const userRef = doc(usersCollection, userId);
  await updateDoc(userRef, {
    matchesPlayed: stats.played,
    matchesWon: stats.won,
    highlightsReceived: stats.highlights,
    pointsPlayed: stats.pointsPlayed,
  });
};

// ═══════════════════════════════
// Notifications System
// ═══════════════════════════════

/** Creates a notification for a user. */
export const createNotification = async (
  userId: string,
  type: "match_complete" | "video_processed" | "highlight_received",
  matchId: string,
  title: string,
  message: string
): Promise<string> => {
  const notification: Omit<UserNotification, "id"> = {
    userId,
    type,
    matchId,
    title,
    message,
    read: false,
    createdAt: Date.now(),
  };
  const docRef = await addDoc(collection(db, "notifications"), sanitizeData(notification));
  return docRef.id;
};

/** Retrieves all notifications for a user, sorted newest first. */
export const getUserNotifications = async (userId: string): Promise<UserNotification[]> => {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserNotification);
  return results.sort((a, b) => b.createdAt - a.createdAt);
};

/** Marks a notification as read. */
export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const docRef = doc(db, "notifications", notificationId);
  await updateDoc(docRef, { read: true });
};

/** Subscribes to real-time notification updates for a user. */
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: UserNotification[]) => void
) => {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  return onSnapshot(
    q,
    (snap) => {
      const notifications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserNotification);
      notifications.sort((a, b) => b.createdAt - a.createdAt);
      callback(notifications);
    },
    (error) => {
      console.error(`Failed to subscribe to notifications for user ${userId}:`, error);
    }
  );
};

/** Triggers Cloud Run video processing for the entire match (trimmed VOD and highlights). */
export const triggerHighlightsProcessing = async (
  jobId: string,
  matchId: string,
  payload: {
    perspectiveA?: { rawStoragePath: string; videoOffset: number };
    perspectiveB?: { rawStoragePath: string; videoOffset: number };
    winner: "A" | "B";
    events: MatchEvent[];
  }
): Promise<void> => {
  const url = import.meta.env.VITE_CLOUD_RUN_PROCESSOR_URL;
  if (!url) throw new Error("VITE_CLOUD_RUN_PROCESSOR_URL is not set in .env");

  const resp = await fetch(`${url}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, matchId, ...payload }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Cloud Run error ${resp.status}: ${text}`);
  }
};



