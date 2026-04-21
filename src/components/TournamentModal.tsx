import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Tournament, Match, Standing } from "@/lib/types";
import { statusLabel } from "@/lib/types";
import { Calendar, MapPin, Users, DollarSign, Play, Youtube, Loader2, Trophy as TrophyIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useTransition, useEffect } from "react";
import { createCheckoutSession } from "@/server/stripe";
import { getMatches, getStandings } from "@/lib/api";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function TournamentModal({
  tournament,
  open,
  onOpenChange,
  isAdmin = false,
}: {
  tournament: Tournament | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin?: boolean;
}) {
  const [teamName, setTeamName] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTeam, setSearchTeam] = useState("");
  const [filterPool, setFilterPool] = useState<"All" | "A" | "B">("All");
  const [filterGame, setFilterGame] = useState<"All" | string>("All");
  const [sortBy, setSortBy] = useState<"game" | "team">("game");
  useEffect(() => {
    if (open && tournament?.id) {
      setLoading(true);
      Promise.all([
        getMatches(tournament.id),
        getStandings(tournament.id)
      ]).then(([m, s]) => {
        setMatches(m);
        setStandings(s);
      }).finally(() => setLoading(false));
    } else {
      setMatches([]);
      setStandings([]);
    }
  }, [open, tournament?.id]);

  if (!tournament) return null;

  const showFixtures = (tournament.status === "filled" || tournament.status === "complete") && matches.length > 0;
  const isOpen = tournament.status === "open";
  const noFixturesYet = (tournament.status === "filled" || tournament.status === "complete") && matches.length === 0;

  const sortedMatches = [...matches].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  
  const filteredMatches = sortedMatches.filter((m, idx) => {
    const gameNum = idx + 1;
    const matchesTeam = m.teamA.toLowerCase().includes(searchTeam.toLowerCase()) || 
                       m.teamB.toLowerCase().includes(searchTeam.toLowerCase());
    const matchesPool = filterPool === "All" || m.pool === filterPool;
    const matchesGame = filterGame === "All" || gameNum.toString() === filterGame;
    
    return matchesTeam && matchesPool && matchesGame;
  });

  const sortedFilteredMatches = [...filteredMatches].sort((a, b) => {
    if (sortBy === "game") {
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    }
    return a.teamA.localeCompare(b.teamA);
  });

  const availableGames = Array.from({ length: matches.length }, (_, i) => (i + 1).toString());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass-strong border-border p-0">
        <div className="relative p-6 border-b border-border bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  isOpen && "bg-primary/15 text-primary border-primary/30",
                  tournament.status === "filled" && "bg-warning/15 text-warning border-warning/30",
                  tournament.status === "complete" && "bg-muted text-muted-foreground border-border",
                )}
              >
                {statusLabel[tournament.status]}
              </span>
            </div>
            <DialogTitle className="text-2xl">{tournament.name}</DialogTitle>
            {tournament.description && (
              <p className="mt-2 text-sm text-muted-foreground">{tournament.description}</p>
            )}
          </DialogHeader>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat icon={Calendar} label={new Date(tournament.dateStart).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} />
            <Stat icon={MapPin} label={tournament.location} />
            <Stat icon={Users} label={`${tournament.registeredTeams?.length || 0}/${tournament.maxTeams} teams`} />
            <Stat icon={DollarSign} label={`$${tournament.entryFee}`} />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Loading tournament data...</p>
          </div>
        ) : showFixtures ? (
          <Tabs defaultValue="fixtures" className="p-6">
            <TabsList className="bg-muted">
              <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
              <TabsTrigger value="standings">Standings</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
            </TabsList>

            <TabsContent value="fixtures" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input 
                    placeholder="Search by team..." 
                    value={searchTeam}
                    onChange={(e) => setSearchTeam(e.target.value)}
                    className="bg-muted/30 border-border h-9 text-xs pl-8"
                  />
                  <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="flex gap-2">
                  <select 
                    value={filterPool}
                    onChange={(e) => setFilterPool(e.target.value as any)}
                    className="bg-muted/30 border border-border rounded-md px-3 h-9 text-xs focus:ring-1 focus:ring-primary outline-none min-w-[100px]"
                  >
                    <option value="All">All Pools</option>
                    <option value="A">Pool A</option>
                    <option value="B">Pool B</option>
                  </select>
                  <select 
                    value={filterGame}
                    onChange={(e) => setFilterGame(e.target.value)}
                    className="bg-muted/30 border border-border rounded-md px-3 h-9 text-xs focus:ring-1 focus:ring-primary outline-none min-w-[100px]"
                  >
                    <option value="All">All Games</option>
                    {availableGames.map(g => (
                      <option key={g} value={g}>Game {g}</option>
                    ))}
                  </select>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-muted/30 border border-border rounded-md px-3 h-9 text-xs focus:ring-1 focus:ring-primary outline-none min-w-[100px]"
                  >
                    <option value="game">Sort by Game</option>
                    <option value="team">Sort by Team</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
              {sortedFilteredMatches.map((m) => {
                const gameIndex = sortedMatches.findIndex(x => x.id === m.id) + 1;
                const MatchContent = (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary/30 transition-colors group",
                      isAdmin && "hover:bg-primary/5 cursor-pointer ring-offset-background hover:ring-1 hover:ring-primary/20"
                    )}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="text-xs text-muted-foreground w-16 shrink-0">
                        <div className="font-semibold text-primary/80">Game {gameIndex}</div>
                        <div className="text-[10px] uppercase">Court {m.court}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {m.teamA} <span className="text-muted-foreground mx-1">vs</span> {m.teamB}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {m.stage} {m.pool && `· Pool ${m.pool}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {m.status === "complete" && (
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {m.scoreA}–{m.scoreB}
                        </span>
                      )}
                      {m.status === "scheduled" && (
                        <span className="text-xs text-muted-foreground">Upcoming</span>
                      )}
                      {isAdmin && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div className="flex gap-1">
                        {m.vodUrlA && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Team A VOD" asChild>
                            <a href={m.vodUrlA} target="_blank" rel="noreferrer">
                              <Play className="h-3.5 w-3.5 text-primary" />
                            </a>
                          </Button>
                        )}
                        {m.vodUrlB && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Team B VOD" asChild>
                            <a href={m.vodUrlB} target="_blank" rel="noreferrer">
                              <Play className="h-3.5 w-3.5 text-secondary" />
                            </a>
                          </Button>
                        )}
                        {m.matchHighlightsUrl && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Highlights" asChild>
                            <a href={m.matchHighlightsUrl} target="_blank" rel="noreferrer">
                              <Youtube className="h-3.5 w-3.5 text-destructive" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );

                if (isAdmin) {
                  return (
                    <Link 
                      key={m.id} 
                      to="/admin/score/$matchId" 
                      params={{ matchId: m.id }}
                      className="block no-underline"
                    >
                      {MatchContent}
                    </Link>
                  );
                }

                return <div key={m.id}>{MatchContent}</div>;
              })}
              {filteredMatches.length === 0 && (
                <div className="p-8 text-center text-muted-foreground italic border border-dashed rounded-lg">
                  No matches found matching your filters.
                </div>
              )}
              </div>
            </TabsContent>

            <TabsContent value="standings" className="mt-4">
              {standings.length > 0 ? (
                (["A", "B"] as const).map((pool, idx) => {
                  const poolStandings = standings.filter(s => (s as any).pool === pool);
                  if (poolStandings.length === 0) return null;

                  return (
                    <div key={pool} className={cn(idx > 0 && "mt-6")}>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pool {pool}</h4>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">Team</th>
                              <th className="px-3 py-2 text-right">P</th>
                              <th className="px-3 py-2 text-right">W</th>
                              <th className="px-3 py-2 text-right">L</th>
                              <th className="px-3 py-2 text-right">Pts</th>
                              <th className="px-3 py-2 text-right">Diff</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poolStandings.map((s, sIdx) => (
                              <tr key={s.team} className="border-t border-border hover:bg-muted/10">
                                <td className="px-3 py-2 font-medium flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-3">{sIdx + 1}</span>
                                  {s.team}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">{s.played}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{s.won}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{s.lost}</td>
                                <td className="px-3 py-2 text-right font-semibold text-primary tabular-nums">{s.points}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center border rounded-xl border-dashed">
                  <TrophyIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground italic">No standings data available yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="teams" className="mt-4 grid sm:grid-cols-2 gap-2">
              {[...(tournament.registeredTeams || [])]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <div key={t.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">Captain · {t.captain}</div>
                  </div>
                ))}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-6 space-y-6">
            {noFixturesYet && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary animate-pulse" />
                  </div>
                </div>
                <h4 className="font-semibold text-lg text-primary mb-2">
                  Ready for Fixtures
                </h4>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  The tournament has reached its capacity. Generate the pool play and placement matches now.
                </p>
                {isAdmin ? (
                  <Button 
                    onClick={async () => {
                      setLoading(true);
                      console.log("Admin clicked Generate Fixtures for:", tournament.id);
                      import("@/lib/api").then(api => api.createFixtures(tournament.id))
                        .then(() => {
                          console.log("Fixtures generated, reloading...");
                          window.location.reload();
                        })
                        .catch(err => {
                          console.error("Fixture generation failed:", err);
                        })
                        .finally(() => setLoading(false));
                    }}
                    className="bg-primary hover:bg-primary-glow text-primary-foreground shadow-glow-sm px-8"
                  >
                    <Zap className="h-4 w-4 mr-2" /> Generate 8-Team Fixture
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Our admins are currently preparing the match schedule. Check back soon!
                  </p>
                )}
              </div>
            )}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Registered teams ({tournament.registeredTeams?.length || 0}/{tournament.maxTeams})
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {[...(tournament.registeredTeams || [])]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((t) => (
                    <div key={t.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">Captain · {t.captain}</div>
                    </div>
                  ))}
                {Array.from({ length: tournament.maxTeams - (tournament.registeredTeams?.length || 0) }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground"
                  >
                    Open slot
                  </div>
                ))}
              </div>
            </div>

            {isOpen ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <h4 className="font-semibold mb-1">Register your team</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  ${tournament.entryFee} entry · You'll be set as the team captain.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="bg-background border-border"
                  />
                  <Button
                    onClick={async () => {
                      if (!teamName) return;
                      const res = await createCheckoutSession({
                        data: {
                          tournamentId: tournament.id,
                          tournamentName: tournament.name,
                          teamName,
                          price: tournament.entryFee,
                          origin: window.location.origin,
                        }
                      });
                      if (res.url) {
                        window.location.href = res.url;
                      }
                    }}
                    disabled={!teamName}
                    className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" /> Pay & Register
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Registration is closed for this tournament.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="truncate text-foreground">{label}</span>
    </div>
  );
}
