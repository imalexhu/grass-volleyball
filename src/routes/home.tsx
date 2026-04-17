import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { TournamentCard } from "@/components/TournamentCard";
import { TournamentModal } from "@/components/TournamentModal";
import { tournaments } from "@/lib/mockData";
import type { Tournament, TournamentStatus } from "@/lib/mockData";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Tournaments — Adelaide Grass Volleyball" },
      { name: "description", content: "Browse open, live, and completed grass volleyball tournaments in Adelaide." },
    ],
  }),
});

const filters: { label: string; value: "all" | TournamentStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Live", value: "in_progress" },
  { label: "Complete", value: "complete" },
];

function Home() {
  const [active, setActive] = useState<Tournament | null>(null);
  const [filter, setFilter] = useState<"all" | TournamentStatus>("all");
  const [query, setQuery] = useState("");

  const list = useMemo(
    () =>
      tournaments.filter(
        (t) =>
          (filter === "all" || t.status === filter) &&
          t.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Tournaments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {list.length} {list.length === 1 ? "event" : "events"} · Adelaide region
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tournaments…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-surface border-border"
            />
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-border">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative",
                filter === f.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {filter === f.value && (
                <span className="absolute inset-x-0 -bottom-px h-px bg-primary shadow-glow" />
              )}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => (
            <TournamentCard key={t.id} tournament={t} onClick={() => setActive(t)} />
          ))}
        </div>

        {list.length === 0 && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            No tournaments match your filters.
          </div>
        )}
      </div>

      <TournamentModal tournament={active} open={!!active} onOpenChange={(v) => !v && setActive(null)} />
    </div>
  );
}
