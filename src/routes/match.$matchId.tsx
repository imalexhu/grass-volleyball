import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { getMatch, subscribeToMatch, updateMatchVideoUrl, getTournament } from "@/lib/api";
import type { Match, Tournament } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { ChevronLeft, UploadCloud, Loader2, Video, Trophy, Zap, Home, ChevronRight } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/match/$matchId")({
  component: MatchDetails,
});

function MatchDetails() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMatch(matchId).then(async (m) => {
      setMatch(m);
      if (m?.tournamentId) {
        const t = await getTournament(m.tournamentId);
        setTournament(t);
      }
      setLoading(false);
    });

    const unsubscribe = subscribeToMatch(matchId, (m) => {
      setMatch(m);
    });

    return () => unsubscribe();
  }, [matchId]);
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 w-full">
        <p className="text-muted-foreground">Match not found.</p>
        <Button asChild variant="outline">
          <Link to="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  const isLive = match.status === "live";
  const isComplete = match.status === "complete";
  const scoreA = isComplete ? match.scoreA : match.currentSetScoreA;
  const scoreB = isComplete ? match.scoreB : match.currentSetScoreB;

  return (
    <div className="flex-1 w-full flex flex-col">
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/home">Tournaments</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {tournament && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{tournament.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Match {match.court ? `(Court ${match.court})` : matchId.substring(0, 4)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header section */}
        <div className="glass-strong border border-border rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                Court {match.court}
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                {match.stage} {match.pool ? `· Pool ${match.pool}` : ""}
              </span>
            </div>
            {isLive && (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 animate-pulse">
                <Zap className="h-3 w-3 fill-primary" /> Live
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border">
                Complete
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-8 md:gap-16">
            <div className="text-center space-y-4">
              <div className="text-sm md:text-xl font-black uppercase tracking-[0.1em] text-muted-foreground truncate px-2">
                {match.teamA}
              </div>
              <div className="text-7xl md:text-8xl font-black text-gradient-primary tabular-nums tracking-tighter">
                {scoreA ?? 0}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-[1px] bg-border/40" />
              <div className="text-sm font-black text-muted-foreground/30 italic">VS</div>
              <div className="h-16 w-[1px] bg-border/40" />
            </div>

            <div className="text-center space-y-4">
              <div className="text-sm md:text-xl font-black uppercase tracking-[0.1em] text-muted-foreground truncate px-2">
                {match.teamB}
              </div>
              <div className="text-7xl md:text-8xl font-black text-gradient-primary tabular-nums tracking-tighter">
                {scoreB ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-black tracking-tight">Match Events</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {match.events && match.events.length > 0 ? (
                match.events.map((event, i) => (
                  <div
                    key={event.id || i}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-sm font-bold bg-muted px-2 py-1 rounded-md text-muted-foreground">
                        {event.scoreA}-{event.scoreB}
                      </div>
                      <div>
                        <div className="text-sm font-semibold capitalize">
                          {event.type}
                        </div>
                        {event.team && (
                          <div className="text-xs text-muted-foreground">
                            {event.team === "A" ? match.teamA : match.teamB}
                          </div>
                        )}
                      </div>
                    </div>
                    {event.isHighlight && (
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20">
                        <Trophy className="h-3 w-3 fill-yellow-500" /> HIGHLIGHT
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground italic border border-dashed rounded-xl border-border">
                  No events recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {isComplete && (
              <>
                {match.matchHighlightsUrl && (
                  <div className="rounded-xl border border-border p-4 bg-card/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Match VOD</div>
                        <div className="text-xs text-muted-foreground">Uploaded successfully</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={match.matchHighlightsUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
