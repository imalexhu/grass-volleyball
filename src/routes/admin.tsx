import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { tournaments, sampleMatches } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Video, Calendar, Plus, Radio, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: "Admin — Adelaide Grass Volleyball" }] }),
});

function Admin() {
  const liveMatch = sampleMatches.find((m) => m.status === "in_progress");
  const open = tournaments.filter((t) => t.status === "open").length;
  const live = tournaments.filter((t) => t.status === "in_progress").length;
  const teams = tournaments.reduce((s, t) => s + t.registeredTeams.length, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary mb-1">Admin</div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <Button className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
            <Plus className="h-4 w-4" /> New tournament
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat icon={Calendar} label="Open registrations" value={open} />
          <Stat icon={Radio} label="Live now" value={live} accent />
          <Stat icon={Users} label="Total registered teams" value={teams} />
          <Stat icon={Video} label="VOD jobs pending" value={2} />
        </div>

        {liveMatch && (
          <Link
            to="/admin/score/$matchId"
            params={{ matchId: liveMatch.id }}
            className="block rounded-2xl border border-destructive/40 bg-destructive/5 p-5 mb-8 hover:border-destructive/60 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-destructive">Match in progress</div>
                  <div className="font-semibold mt-0.5">
                    {liveMatch.teamA} vs {liveMatch.teamB} · Court {liveMatch.court}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-destructive/40 group-hover:border-destructive">
                Open scoring pad <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Link>
        )}

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
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(t.dateStart).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.registeredTeams.length}/{t.maxTeams}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-xs",
                            t.status === "open" && "border-primary/30 bg-primary/10 text-primary",
                            t.status === "full" && "border-warning/30 bg-warning/10 text-warning",
                            t.status === "in_progress" && "border-destructive/30 bg-destructive/10 text-destructive",
                            t.status === "complete" && "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {t.status}
                        </span>
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
              <Action icon={Trophy} label="Create tournament" />
              <Action icon={Users} label="Manage users" />
              <Action icon={Video} label="VOD pipeline" />
              <Action icon={Calendar} label="Generate fixtures" />
            </div>
          </div>
        </div>
      </div>
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

function Action({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition-all">
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
