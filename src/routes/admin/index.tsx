import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
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
import { Loader2, Zap } from "lucide-react";
import { TournamentModal } from "@/components/TournamentModal";
import { useState } from "react";
import { QuickMatchDialog } from "@/components/QuickMatchDialog";
import { getMatches, getTournament } from "@/lib/api";
import type { Match } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin — Adelaide Grass Volleyball" }] }),
});

function Admin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
  });

  const { data: allMatches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ["all-matches"],
    queryFn: () => getMatches(),
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
      comparison = a.court - b.court;
    } else if (sortConfig.field === "status") {
      comparison = a.status.localeCompare(b.status);
    } else {
      comparison = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    }

    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      // Seed tournaments
      for (const t of mockTournaments) {
        const { id, ...data } = t;
        await createTournament(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
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
      toast.success("Fixtures generated and matches created!");
    },
    onError: (error: any) => {
      console.error("Failed to create fixtures:", error);
      toast.error(error.message || "Failed to create fixtures");
    }
  });

  const testFixtureMutation = useMutation({
    mutationFn: createTestTournamentWithTeams,
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
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
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary mb-1">Admin</div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex gap-2">
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
            <CreateTournamentDialog />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Stat icon={Calendar} label="Open registrations" value={open} />
          <Stat icon={Users} label="Total registered teams" value={teams} />
          <Stat icon={Video} label="VOD jobs pending" value={2} />
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
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
                  ) : tournaments.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No tournaments found. Seed some data to get started.</td></tr>
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">All Matches</h2>
              <div className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded uppercase tracking-widest">{allMatches.length} Total</div>
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
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading matches...</td></tr>
                  ) : sortedMatches.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No matches found.</td></tr>
                  ) : sortedMatches.map((m) => (
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
                          <span className="font-bold group-hover:text-primary transition-colors">{m.teamA} vs {m.teamB}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{m.stage} {m.label ? `· ${m.label}` : ""}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">Court {m.court}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.status === "complete" ? (
                          <div className="flex flex-col items-end">
                            <span className="font-black text-primary">{m.scoreA} - {m.scoreB}</span>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold">Final</span>
                          </div>
                        ) : m.status === "live" ? (
                          <div className="flex flex-col items-end">
                            <span className="font-black text-destructive animate-pulse">
                              {m.events && m.events.length > 0 ? (m.events[m.events.length-1].scoreA) : 0} - {m.events && m.events.length > 0 ? (m.events[m.events.length-1].scoreB) : 0}
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
                            m.status === "complete" && "border-success/30 bg-success/10 text-success",
                          )}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="sm" variant="ghost" className="h-8 group/btn">
                          <Link to={`/admin/score/${m.id}`}>
                            Score <Zap className="ml-2 h-3 w-3 text-primary group-hover/btn:fill-primary" />
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
              <Action
                icon={Zap}
                label="Quick Test: 8-Team Fixture"
                onClick={() => testFixtureMutation.mutate()}
                loading={testFixtureMutation.isPending}
              />
              <Action icon={Users} label="Manage users" />
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
