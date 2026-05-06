import { createFileRoute, Link } from "@tanstack/react-router";

import { tournaments as mockTournaments } from "@/lib/mockData";
import { getTournaments, createTournament, clearAllData } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Video, Calendar, Plus, Radio, ArrowUpRight, Database, Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateTournamentDialog } from "@/components/CreateTournamentDialog";
import { EditTournamentDialog } from "@/components/EditTournamentDialog";
import { deleteTournament, createFixtures, createTestTournamentWithTeams, completeTournament } from "@/lib/api";
import { statusLabel, type Tournament } from "@/lib/types";
import { Loader2, Zap, Calendar as CalendarIcon, FileX, Volleyball } from "lucide-react";
import { TournamentModal } from "@/components/TournamentModal";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickMatchDialog } from "@/components/QuickMatchDialog";
import { getMatches, getTournament } from "@/lib/api";
import type { Match } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/manage/")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin — Adelaide Grass Volleyball" }] }),
});

function Admin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin";
  const isOrg = userProfile?.role === "organization";

  const { data: rawTournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
  });

  const tournaments = rawTournaments.filter(t => {
    if (isAdmin) return true;
    if (isOrg) return t.organizerId === userProfile.id;
    return false; // players shouldn't really be here, but just in case
  });

  const { data: rawMatches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ["all-matches"],
    queryFn: () => getMatches(),
  });

  if (!isLoading && !isLoadingMatches && userProfile && userProfile.role === "player") {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md px-6">
          <div className="bg-primary/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Your account is currently set to <strong>Player</strong>. Only Organization or Administrator accounts can manage tournaments and matches.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild variant="outline">
              <Link to="/">Return to Home</Link>
            </Button>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-4">
              Contact an administrator to upgrade your role.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allMatches = rawMatches.filter(m => {
    if (isAdmin) return true;
    if (isOrg) {
      if (m.organizerId === userProfile.id) return true;
      if (m.tournamentId) {
        return tournaments.some(t => t.id === m.tournamentId);
      }
      return false;
    }
    return false;
  });

  const [sortConfig, setSortConfig] = useState<{ field: "court" | "status" | "scheduledAt", direction: "asc" | "desc" }>({
    field: "scheduledAt",
    direction: "desc"
  });

  const toggleSort = (field: "court" | "status") => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const sortedMatches = [...allMatches].sort((a, b) => {
    // 1. Live matches always at the top
    if (a.status === "live" && b.status !== "live") return -1;
    if (b.status === "live" && a.status !== "live") return 1;

    // 2. Secondary sort based on user selection
    let comparison = 0;
    if (sortConfig.field === "court") {
      comparison = (a.court ?? 0) - (b.court ?? 0);
    } else if (sortConfig.field === "status") {
      comparison = a.status.localeCompare(b.status);
    } else {
      const timeA = new Date(a.scheduledAt).getTime();
      const timeB = new Date(b.scheduledAt).getTime();
      
      if (isNaN(timeA) && isNaN(timeB)) comparison = 0;
      else if (isNaN(timeA)) comparison = 1;
      else if (isNaN(timeB)) comparison = -1;
      else comparison = timeA - timeB;
    }

    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  const filteredOutCount = rawMatches.length - allMatches.length;

  const pendingMatches = sortedMatches.filter(m => m.status !== "complete");
  const completedMatches = sortedMatches.filter(m => m.status === "complete");

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!userProfile) throw new Error("Must be logged in to seed data");
      // Seed tournaments
      for (const t of mockTournaments) {
        const { id, ...data } = t;
        await createTournament({ ...data, organizerId: userProfile.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Successfully seeded mock data to Firestore");
    },
    onError: (error) => {
      console.error("Failed to seed data:", error);
      toast.error("Failed to seed data. Check console for details.");
    }
  });

  const clearMutation = useMutation({
    mutationFn: clearAllData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Successfully cleared all data from Firestore");
    },
    onError: (error) => {
      console.error("Failed to clear data:", error);
      toast.error("Failed to clear data. Check console for details.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Tournament deleted");
    },
    onError: (error) => {
      console.error("Failed to delete tournament:", error);
      toast.error("Failed to delete tournament");
    }
  });

  const fixtureMutation = useMutation({
    mutationFn: createFixtures,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Fixtures generated and matches created!");
    },
    onError: (error: any) => {
      console.error("Failed to create fixtures:", error);
      toast.error(error.message || "Failed to create fixtures");
    }
  });

  const testFixtureMutation = useMutation({
    mutationFn: () => createTestTournamentWithTeams(userProfile?.id),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["all-matches"] });
      toast.success("Created test tournament with 8 teams!");
    },
    onError: (error) => {
      console.error("Failed to create test tournament:", error);
      toast.error("Failed to create test tournament");
    }
  });

  const completeMutation = useMutation({
    mutationFn: completeTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament marked as complete");
    },
    onError: (error) => {
      console.error("Failed to complete tournament:", error);
      toast.error("Failed to mark tournament as complete");
    }
  });

  const open = tournaments.filter((t) => t.status === "open").length;
  const teams = tournaments.reduce((s, t) => s + (t.registeredTeams?.length || 0), 0);

  return (
    <div className="flex-1 w-full">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary mb-1">Manage</div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {isOrg ? "Organization Dashboard" : "Global Dashboard"}
            </h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive border-border hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                      clearMutation.mutate();
                    }
                  }}
                  disabled={clearMutation.isPending || isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearMutation.isPending ? "Clearing..." : "Clear Data"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  <Database className="h-4 w-4 mr-2" />
                  {seedMutation.isPending ? "Seeding..." : "Seed Data"}
                </Button>
              </>
            )}
            <CreateTournamentDialog />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Stat icon={Calendar} label="Open registrations" value={open} />
          <Stat icon={Users} label="Total registered teams" value={teams} />
          <Stat icon={Video} label="VOD jobs pending" value={0} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tournaments</h2>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Teams</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-4 py-3 text-right"><Skeleton className="h-5 w-12 ml-auto" /></td>
                        <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-24 ml-auto" /></td>
                      </tr>
                    ))
                  ) : tournaments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <CalendarIcon className="h-8 w-8 mb-3 text-muted-foreground/50" />
                          <p className="text-sm font-medium">No tournaments found</p>
                          <p className="text-xs mt-1">Seed some data or create a new tournament to get started.</p>
                        </div>
                      </td>
                    </tr>
                  ) : tournaments.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setActiveTournament(t)}
                    >
                      <td className="px-4 py-3 font-medium group-hover:text-primary transition-colors">{t.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(t.dateStart).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.registeredTeams?.length || 0}/{t.maxTeams}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs",
                            t.status === "open" && "border-primary/30 bg-primary/10 text-primary",
                            t.status === "filled" && "border-warning/30 bg-warning/10 text-warning",
                            t.status === "complete" && "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {statusLabel[t.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {t.status === "filled" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => fixtureMutation.mutate(t.id)}
                                disabled={fixtureMutation.isPending}
                                title="Generate Fixtures"
                              >
                                {fixtureMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                onClick={() => {
                                  if (window.confirm(`Mark "${t.name}" as complete?`)) {
                                    completeMutation.mutate(t.id);
                                  }
                                }}
                                disabled={completeMutation.isPending}
                                title="Mark Complete"
                              >
                                {completeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                              </Button>
                            </>
                          )}
                          <EditTournamentDialog tournament={t} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${t.name}"?`)) {
                                deleteMutation.mutate(t.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mb-3 mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending & Live Matches</h2>
              <div className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded uppercase tracking-widest">{pendingMatches.length} Total</div>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Match</th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleSort("court")}
                    >
                      <div className="flex items-center gap-1">
                        Court
                        {sortConfig.field === "court" && (
                          <span className="text-[10px]">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleSort("status")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Status
                        {sortConfig.field === "status" && (
                          <span className="text-[10px]">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right">Scoring</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingMatches ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-3"><Skeleton className="h-8 w-40" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-20 ml-auto" /></td>
                      </tr>
                    ))
                  ) : pendingMatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Volleyball className="h-8 w-8 mb-3 text-muted-foreground/50" />
                          <p className="text-sm font-medium">No pending matches</p>
                          <p className="text-xs mt-1">Generate fixtures from a filled tournament.</p>
                          {isOrg && filteredOutCount > 0 && (
                            <p className="text-[10px] mt-4 text-muted-foreground italic bg-muted/50 px-3 py-2 rounded-lg border border-border/50">
                              Tip: {filteredOutCount} matches exist but are assigned to other organizations or have no organizer set.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : pendingMatches.map((m) => (
                    <tr
                      key={m.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => {
                        const tournament = tournaments.find(t => t.id === m.tournamentId);
                        if (tournament) {
                          setActiveTournament(tournament);
                        } else if (m.tournamentId) {
                          getTournament(m.tournamentId).then(t => {
                            if (t) setActiveTournament(t);
                          });
                        }
                      }}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <span className="font-bold flex items-center gap-1.5">
                            <Link to="/team/$teamId" params={{ teamId: m.teamA }} onClick={e => e.stopPropagation()} className="hover:text-primary hover:underline transition-colors">{m.teamA}</Link>
                            <span className="text-muted-foreground font-normal text-xs mx-0.5">vs</span>
                            <Link to="/team/$teamId" params={{ teamId: m.teamB }} onClick={e => e.stopPropagation()} className="hover:text-primary hover:underline transition-colors">{m.teamB}</Link>
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">{m.stage} {m.label ? `· ${m.label}` : ""}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">Court {m.court}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.status === "live" ? (
                          <div className="flex flex-col items-end">
                            <span className="font-black text-destructive animate-pulse">
                              {m.events && m.events.length > 0 ? (m.events[m.events.length - 1].scoreA) : 0} - {m.events && m.events.length > 0 ? (m.events[m.events.length - 1].scoreB) : 0}
                            </span>
                            <span className="text-[9px] text-destructive uppercase font-bold">Live Set</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase font-black tracking-widest",
                            m.status === "scheduled" && "border-border bg-muted text-muted-foreground",
                            m.status === "live" && "border-destructive/30 bg-destructive/10 text-destructive",
                          )}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="sm" variant="ghost" className="h-8 group/btn">
                          <Link to="/manage/score/$matchId" params={{ matchId: m.id }}>
                            Score <Zap className="ml-2 h-3 w-3 text-primary group-hover/btn:fill-primary" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mb-3 mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Completed Matches</h2>
              <div className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded uppercase tracking-widest">{completedMatches.length} Total</div>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Match</th>
                    <th className="px-4 py-3 text-left">Court</th>
                    <th className="px-4 py-3 text-right">Final Score</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">Processing</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingMatches ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-3"><Skeleton className="h-8 w-40" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-6 w-16 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-32 ml-auto" /></td>
                      </tr>
                    ))
                  ) : completedMatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileX className="h-8 w-8 mb-3 text-muted-foreground/50" />
                          <p className="text-sm font-medium">No completed matches</p>
                          <p className="text-xs mt-1">Finish a live match to see it here.</p>
                        </div>
                      </td>
                    </tr>
                  ) : completedMatches.map((m) => (
                    <tr
                      key={m.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => {
                        const tournament = tournaments.find(t => t.id === m.tournamentId);
                        if (tournament) {
                          setActiveTournament(tournament);
                        } else if (m.tournamentId) {
                          getTournament(m.tournamentId).then(t => {
                            if (t) setActiveTournament(t);
                          });
                        }
                      }}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <span className="font-bold flex items-center gap-1.5">
                            <Link to="/team/$teamId" params={{ teamId: m.teamA }} onClick={e => e.stopPropagation()} className="hover:text-primary hover:underline transition-colors">{m.teamA}</Link>
                            <span className="text-muted-foreground font-normal text-xs mx-0.5">vs</span>
                            <Link to="/team/$teamId" params={{ teamId: m.teamB }} onClick={e => e.stopPropagation()} className="hover:text-primary hover:underline transition-colors">{m.teamB}</Link>
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">{m.stage} {m.label ? `· ${m.label}` : ""}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">Court {m.court}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-primary">{m.scoreA} - {m.scoreB}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase font-black tracking-widest border-success/30 bg-success/10 text-success">
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="sm" variant="outline" className="h-8 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary">
                          <Link to="/manage/postmatch-process/$matchId" params={{ matchId: m.id }}>
                            <Video className="mr-2 h-3 w-3" /> Post Match Processing
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick actions</h2>
            <div className="space-y-2">
              <QuickMatchDialog />
              {isAdmin && (
                <>
                  <Action
                    icon={Zap}
                    label="Quick Test: 8-Team Fixture"
                    onClick={() => testFixtureMutation.mutate()}
                    loading={testFixtureMutation.isPending}
                  />
                  <Action icon={Users} label="Manage users" />
                </>
              )}
              {isOrg && (
                <Action icon={Users} label="Organization Profile" onClick={() => navigate({ to: "/org/$orgId", params: { orgId: userProfile?.id || "unknown" } })} />
              )}
              <Action icon={Video} label="VOD pipeline" />
            </div>
          </div>
        </div>
      </div>

      <TournamentModal
        tournament={activeTournament}
        open={!!activeTournament}
        onOpenChange={(v) => !v && setActiveTournament(null)}
        isAdmin={true}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", accent ? "text-destructive" : "text-primary")} />
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  loading
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition-all text-left",
        loading && "opacity-50 pointer-events-none"
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-3">
        {loading ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <Icon className="h-4 w-4 text-primary" />}
        {label}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
