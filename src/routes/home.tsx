import { createFileRoute } from "@tanstack/react-router";

import { TournamentCard } from "@/components/TournamentCard";
import { TournamentModal } from "@/components/TournamentModal";
import { getTournaments } from "@/lib/api";
import type { Tournament, TournamentStatus } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Map, Calendar as CalendarIcon, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  { label: "Filled", value: "filled" },
  { label: "Complete", value: "complete" },
];

function Home() {
  const [active, setActive] = useState<Tournament | null>(null);
  const [filter, setFilter] = useState<"all" | TournamentStatus>("all");
  const [formatFilter, setFormatFilter] = useState<"all" | string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [query, setQuery] = useState("");

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
  });

  const availableFormats = useMemo(() => {
    const formats = new Set(tournaments.map(t => t.format).filter(Boolean));
    return Array.from(formats);
  }, [tournaments]);

  const list = useMemo(
    () =>
      tournaments.filter(
        (t) =>
          (filter === "all" || t.status === filter) &&
          (formatFilter === "all" || t.format === formatFilter) &&
          (!dateFilter || t.dateStart === dateFilter) &&
          t.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, formatFilter, dateFilter, query, tournaments],
  );

  return (
    <div className="flex-1 w-full">

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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border pb-4 sm:pb-0">
          <div className="flex gap-1 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                  filter === f.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                {filter === f.value && (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-primary shadow-glow" />
                )}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs bg-surface border-border">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  {availableFormats.map(fmt => (
                    <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input 
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-[140px] h-9 text-xs bg-surface border-border"
              />
              {dateFilter && (
                <button 
                  onClick={() => setDateFilter("")}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))
          ) : list.length > 0 ? (
            list.map((t) => (
              <TournamentCard key={t.id} tournament={t} onClick={() => setActive(t)} />
            ))
          ) : (
            <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <Map className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">No tournaments found</h3>
              <p className="text-sm text-muted-foreground max-w-[300px]">
                Try adjusting your filters or search query to find what you're looking for.
              </p>
            </div>
          )}
        </div>


      </div>

      <TournamentModal tournament={active} open={!!active} onOpenChange={(v) => !v && setActive(null)} />
    </div>
  );
}
