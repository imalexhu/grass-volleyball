import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { Tournament, Match, Standing, Team } from "./types";

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
  const tournament = await getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found");

  const teams = tournament.registeredTeams || [];
  if (teams.length < 2) throw new Error("Not enough teams to create fixtures");

  // Simple Pool Generation (A, B)
  const poolA: Team[] = [];
  const poolB: Team[] = [];

  teams.forEach((team, index) => {
    if (index % 2 === 0) poolA.push(team);
    else poolB.push(team);
  });

  const matches: Omit<Match, "id">[] = [];

  // Generate Round Robin for Pool A
  for (let i = 0; i < poolA.length; i++) {
    for (let j = i + 1; j < poolA.length; j++) {
      matches.push({
        tournamentId,
        stage: "pool",
        pool: "A",
        teamA: poolA[i].name,
        teamB: poolA[j].name,
        court: 1,
        scheduledAt: new Date(tournament.dateStart).toISOString(),
        status: "scheduled",
      });
    }
  }

  // Generate Round Robin for Pool B
  for (let i = 0; i < poolB.length; i++) {
    for (let j = i + 1; j < poolB.length; j++) {
      matches.push({
        tournamentId,
        stage: "pool",
        pool: "B",
        teamA: poolB[i].name,
        teamB: poolB[j].name,
        court: 2,
        scheduledAt: new Date(tournament.dateStart).toISOString(),
        status: "scheduled",
      });
    }
  }

  // Save matches to Firestore
  for (const match of matches) {
    await addDoc(matchesCollection, match);
  }

  // Initialize empty standings
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
  const q = query(matchesCollection, where("status", "==", "scheduled")); // Use scheduled for active matches
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
};

export const getStandings = async (tournamentId: string): Promise<Standing[]> => {
  const q = query(standingsCollection, where("tournamentId", "==", tournamentId), orderBy("points", "desc"), orderBy("diff", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Standing);
};

// Additional helper functions can be added as needed

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
