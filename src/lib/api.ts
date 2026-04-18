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

export const registerTeamToTournament = async (tournamentId: string, team: Team): Promise<void> => {
  const tournament = await getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found");
  
  const updatedTeams = [...(tournament.registeredTeams || []), team];
  await updateTournament(tournamentId, { registeredTeams: updatedTeams });
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
  const q = query(matchesCollection, where("status", "==", "in_progress"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Match);
};

// Additional helper functions can be added as needed
