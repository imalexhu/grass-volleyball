import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { Tournament, Match, Standing, Team, MatchEvent } from "./types";

// Collections
export const tournamentsCollection = collection(db, "tournaments");
export const matchesCollection = collection(db, "matches");
export const standingsCollection = collection(db, "standings");

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
  const docRef = doc(db, "tournaments", id);
  await deleteDoc(docRef);
};

export const registerTeamToTournament = async (tournamentId: string, team: Team): Promise<void> => {
  const tournament = await getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found");

  // Check if team already registered (prevent duplicates)
  if (tournament.registeredTeams?.some(t => t.name === team.name)) {
    return;
  }

  const updatedTeams = [...(tournament.registeredTeams || []), team];
  const updateData: Partial<Tournament> = { registeredTeams: updatedTeams };

  if (updatedTeams.length >= tournament.maxTeams) {
    updateData.status = "filled";
  }

  await updateTournament(tournamentId, updateData);
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

export const createTestTournamentWithTeams = async (): Promise<string> => {
  const testTeams: Team[] = Array.from({ length: 8 }, (_, i) => ({
    id: `temp-${i + 1}`,
    name: `Team ${i + 1}`,
    captain: "—",
  }));

  const tournamentId = await createTournament({
    name: "Test 8-Team Pro",
    dateStart: new Date().toISOString().split("T")[0],
    dateEnd: new Date().toISOString().split("T")[0],
    location: "City Beach",
    format: "Mixed 4s",
    description: "A test tournament with 8 teams ready for fixture generation.",
    entryFee: 120,
    maxTeams: 8,
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

export const getRunningMatches = async (): Promise<Match[]> => {
  const q = query(matchesCollection, where("status", "==", "live"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
};

export const subscribeToLiveMatches = (callback: (matches: Match[]) => void) => {
  const q = query(matchesCollection, where("status", "==", "live"));
  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
    callback(matches);
  });
};

export const subscribeToMatch = (matchId: string, callback: (match: Match) => void) => {
  const docRef = doc(db, "matches", matchId);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Match);
    }
  });
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
