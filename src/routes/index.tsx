import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { TournamentCard } from "@/components/TournamentCard";
import { TournamentModal } from "@/components/TournamentModal";
import { tournaments } from "@/lib/mockData";
import type { Tournament } from "@/lib/mockData";
import { ArrowRight, Trophy, Zap, Users, Video } from "lucide-react";
import { useState } from "react";

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
  const upcoming = tournaments.filter((t) => t.status === "open" || t.status === "full").slice(0, 3);
  const recent = tournaments.filter((t) => t.status === "complete").slice(0, 3);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-32 sm:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Season 2026 · Now open
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Adelaide's home of <br />
              <span className="text-gradient-primary">grass volleyball.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Register a team, play in pool-play tournaments across the city, and watch every rally back —
              edited and uploaded automatically.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
                <Link to="/home">
                  Browse tournaments <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border bg-surface/50 backdrop-blur">
                <Link to="/register">Create an account</Link>
              </Button>
            </div>
          </div>

          {/* Feature row */}
          <div className="mt-20 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <Feature icon={Trophy} title="Pool play + finals" desc="8 teams, 2 pools, placement & finals brackets." />
            <Feature icon={Video} title="Auto-edited VODs" desc="Dead time stripped, scores burned in, on YouTube." />
            <Feature icon={Zap} title="Live courtside scoring" desc="Mobile-first scoring pad for our event admins." />
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Upcoming tournaments</h2>
            <p className="text-sm text-muted-foreground mt-1">Lock in your team's spot.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcoming.map((t) => (
            <TournamentCard key={t.id} tournament={t} onClick={() => setActive(t)} />
          ))}
        </div>
      </section>

      {/* Recent */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Recent results</h2>
          <p className="text-sm text-muted-foreground mt-1">Catch up on the action — VODs included.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recent.map((t) => (
            <TournamentCard key={t.id} tournament={t} onClick={() => setActive(t)} />
          ))}
        </div>
      </section>

      <footer className="mt-20 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>Adelaide Grass Volleyball · Season 2026</span>
          </div>
          <div className="flex gap-4">
            <Link to="/home" className="hover:text-foreground">Tournaments</Link>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>

      <TournamentModal tournament={active} open={!!active} onOpenChange={(v) => !v && setActive(null)} />
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="glass rounded-2xl p-5 text-left">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/25 mb-3">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}
