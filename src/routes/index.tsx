import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { TournamentCard } from "@/components/TournamentCard";
import { TournamentModal } from "@/components/TournamentModal";
import type { Tournament, Match } from "@/lib/types";
import { ArrowRight, Trophy, Zap, Users, Video, Radio, Trophy as TrophyIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { subscribeToLiveMatches, getTournaments } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Adelaide Grass Volleyball — Local tournaments, live scoring, instant VODs" },
      {
        name: "description",
        content:
          "Register, play, and rewatch grass volleyball tournaments across Adelaide. Pool play, finals, standings, and match VODs all in one place.",
      },
    ],
  }),
});

function Landing() {
  const [active, setActive] = useState<Tournament | null>(null);
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    // Live matches subscription
    return subscribeToLiveMatches((matches) => {
      console.log("Live matches updated:", matches);
      setLiveMatches(matches);
    });
  }, []);

  useEffect(() => {
    getTournaments().then(setTournaments);
  }, []);

  const upcoming = tournaments.filter((t) => t.status === "open" || t.status === "filled").slice(0, 3);
  const recent = tournaments.filter((t) => t.status === "complete").slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-[0.03]" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-32 sm:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-8 animate-fade-in">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Season 2026 Registration Live
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              Adelaide's home of <br />
              <span className="text-gradient-primary">grass volleyball.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Register a team, play in tournaments across the city, and watch every rally back with automated VODs.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="xl" className="bg-primary text-primary-foreground hover:bg-primary-glow shadow-glow-sm h-14 px-8 rounded-2xl text-lg font-bold">
                <Link to="/home">
                  Find a Tournament <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="h-14 px-8 rounded-2xl text-lg font-bold border-border bg-card/40 backdrop-blur-sm">
                <Link to="/register">Join the Club</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Scores Section */}
      {liveMatches.length > 0 && (
        <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center space-x-2 bg-destructive/10 border border-destructive/20 text-destructive px-3 py-1.5 rounded-full">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-destructive">Live Scoring</span>
              </div>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent ml-8" />
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {liveMatches.map((m) => (
              <div 
                key={m.id} 
                className="group relative overflow-hidden rounded-[32px] border border-border bg-card/40 backdrop-blur-xl shadow-2xl transition-all hover:border-primary/40 hover:bg-card/60"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-background px-2.5 py-1 rounded-lg border border-border">
                      Court {m.court}
                    </span>
                    <span className="text-[10px] font-black text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 uppercase tracking-widest">
                      Set {m.events ? (m.events.filter(e => e.type === "set-finish").length + 1) : 1}
                    </span>
                  </div>
                  {m.events && m.events.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground italic truncate max-w-[100px]">
                        {m.events[m.events.length - 1].type === 'point' ? 'Point' : 'Serve'} · {m.events[m.events.length - 1].team === 'A' ? m.teamA.split(' ')[0] : m.teamB.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-8">
                  {(() => {
                    const latestEvent = m.events && m.events.length > 0 ? m.events[m.events.length - 1] : null;
                    const displayScoreA = latestEvent ? latestEvent.scoreA : (m.currentSetScoreA ?? 0);
                    const displayScoreB = latestEvent ? latestEvent.scoreB : (m.currentSetScoreB ?? 0);
                    
                    return (
                      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-6">
                        <div className="text-center space-y-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground truncate px-1">{m.teamA}</div>
                          <div className="text-6xl font-black text-gradient-primary tabular-nums tracking-tighter transition-transform group-hover:scale-110 duration-500">
                            {displayScoreA}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-[1px] bg-border/40" />
                          <div className="text-[10px] font-black text-muted-foreground/30 italic">VS</div>
                          <div className="h-10 w-[1px] bg-border/40" />
                        </div>
                        
                        <div className="text-center space-y-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground truncate px-1">{m.teamB}</div>
                          <div className="text-6xl font-black text-gradient-primary tabular-nums tracking-tighter transition-transform group-hover:scale-110 duration-500">
                            {displayScoreB}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Highlights mini-feed */}
                <div className="px-8 pb-6 flex justify-center flex-wrap gap-2">
                  {m.events && m.events.filter(e => e.isHighlight).slice(-2).map(e => (
                    <div key={e.id} className="flex items-center gap-1.5 text-[9px] font-black text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20">
                        <TrophyIcon className="h-2.5 w-2.5 fill-yellow-500" /> HIGHLIGHT
                    </div>
                  ))}
                  {m.status === "live" && (
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 animate-pulse">
                        <Zap className="h-2.5 w-2.5 fill-primary" /> LIVE TRACKING
                    </div>
                  )}
                </div>

                <div className="mt-auto h-1.5 bg-muted/20 relative overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min(100, ((m.currentSetScoreA || 0) + (m.currentSetScoreB || 0)) * 4)}%` }}
                    />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fixtures & Results */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 bg-muted/5">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Upcoming */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Upcoming Tournaments</h2>
                <p className="text-sm text-muted-foreground mt-2">Join the next event and start playing.</p>
              </div>
            </div>
            <div className="grid gap-4">
              {upcoming.map((t) => (
                <TournamentCard key={t.id} tournament={t} onClick={() => setActive(t)} />
              ))}
              {upcoming.length === 0 && (
                <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl text-muted-foreground">
                  No upcoming tournaments scheduled. Check back soon!
                </div>
              )}
            </div>
          </div>

          {/* Recent */}
          <div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-muted-foreground">Recent Results</h2>
                <p className="text-sm text-muted-foreground mt-2">Watch VODs and check final standings.</p>
              </div>
            </div>
            <div className="grid gap-4">
              {recent.map((t) => (
                <TournamentCard key={t.id} tournament={t} onClick={() => setActive(t)} />
              ))}
              {recent.length === 0 && (
                <div className="p-12 text-center border-2 border-dashed border-border rounded-3xl text-muted-foreground">
                  Tournament archives will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/20 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center sm:items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center">
                 <Trophy className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-black tracking-tighter">AGV</span>
            </div>
            <p className="text-sm text-muted-foreground">Season 2026 · Adelaide, South Australia</p>
          </div>
          <div className="flex gap-8 text-sm font-bold uppercase tracking-widest text-muted-foreground">
             <Link to="/home" className="hover:text-primary transition-colors">Tournaments</Link>
             <Link to="/login" className="hover:text-primary transition-colors">Login</Link>
             <Link to="/register" className="hover:text-primary transition-colors">Join</Link>
          </div>
        </div>
      </footer>

      <TournamentModal tournament={active} open={!!active} onOpenChange={(v) => !v && setActive(null)} />
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card/40 p-6 text-left hover:border-primary/30 transition-all">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-4">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="font-bold text-base mb-1">{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
    </div>
  );
}
