import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Loader2,
  Video,
  Trophy,
  Zap,
  Star,
  Film,
  Play,
  Users,
  Volleyball
} from "lucide-react";

import { getMatch, subscribeToMatch, getTournament } from "@/lib/api";
import type { Match, Tournament, MatchEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/match/$matchId")({
  component: MatchDetails,
  head: () => ({ meta: [{ title: "Match details — Adelaide Grass Volleyball" }] }),
});

interface PlayerMatchStats {
  userId: string;
  displayName: string;
  photoURL?: string;
  team: "A" | "B";
  pointsPlayed: number;
  highlightsReceived: number;
}

const getYouTubeEmbedUrl = (url?: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?\s*v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
};

const formatTime = (ms: number) => {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
};

function MatchDetails() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideoTab, setActiveVideoTab] = useState<"vod" | "highlights" | null>(null);

  useEffect(() => {
    getMatch(matchId)
      .then(async (m) => {
        setMatch(m);
        if (m?.tournamentId) {
          const t = await getTournament(m.tournamentId);
          setTournament(t);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch match details:", err);
        setLoading(false);
      });

    const unsubscribe = subscribeToMatch(matchId, (m) => {
      setMatch(m);
    });

    return () => unsubscribe();
  }, [matchId]);

  // Set initial video tab when match loads
  useEffect(() => {
    if (match) {
      if (match.vodUrl) {
        setActiveVideoTab("vod");
      } else if (match.matchHighlightsUrl) {
        setActiveVideoTab("highlights");
      }
    }
  }, [match]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Match not found.</p>
        <Button asChild variant="outline">
          <Link to="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  const isComplete = match.status === "complete" || match.status === "processed";
  const isLive = match.status === "live" || match.phase === "live";

  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;

  // Calculate dynamic stats
  const statsMap: Record<string, PlayerMatchStats> = {};

  (match.playersA || []).forEach((p) => {
    statsMap[p.userId] = {
      userId: p.userId,
      displayName: p.displayName,
      photoURL: p.photoURL,
      team: "A",
      pointsPlayed: 0,
      highlightsReceived: 0,
    };
  });

  (match.playersB || []).forEach((p) => {
    statsMap[p.userId] = {
      userId: p.userId,
      displayName: p.displayName,
      photoURL: p.photoURL,
      team: "B",
      pointsPlayed: 0,
      highlightsReceived: 0,
    };
  });

  const events = match.events || [];
  events.forEach((event) => {
    if (event.type === "point") {
      const activeA = event.rosterA || [];
      const activeB = event.rosterB || [];

      activeA.forEach((uid) => {
        if (statsMap[uid]) statsMap[uid].pointsPlayed += 1;
      });
      activeB.forEach((uid) => {
        if (statsMap[uid]) statsMap[uid].pointsPlayed += 1;
      });

      if (event.isHighlight && event.highlightPlayerId) {
        const uid = event.highlightPlayerId;
        if (statsMap[uid]) statsMap[uid].highlightsReceived += 1;
      }
    }
  });

  const playerStatsList = Object.values(statsMap).sort((a, b) => b.pointsPlayed - a.pointsPlayed);

  const vodEmbedUrl = getYouTubeEmbedUrl(match.vodUrl);
  const highlightsEmbedUrl = getYouTubeEmbedUrl(match.matchHighlightsUrl);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="flex-1 w-full bg-background min-h-screen">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <Breadcrumb>
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
              <BreadcrumbPage>{match.label || "Match Summary"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Score Header Card */}
        <div className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-10 shadow-lg backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex items-center justify-between mb-8">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 px-3 py-1 rounded-full border">
              {match.stage === "freeplay" || !match.stage ? "Casual Match" : `Stage: ${match.stage}`}
            </span>
            {isLive && (
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 animate-pulse">
                <Zap className="h-3 w-3 fill-primary" /> Live Scoring
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-success bg-success/10 px-3 py-1 rounded-full border border-success/20">
                <Trophy className="h-3 w-3" /> Processed
              </div>
            )}
            {match.status === "action_required" && (
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-warning bg-warning/10 px-3 py-1 rounded-full border border-warning/20 animate-pulse">
                <Video className="h-3 w-3" /> Awaiting VOD
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4 sm:gap-12 max-w-3xl mx-auto">
            <div className="text-center space-y-2.5 min-w-0">
              <div className="text-sm sm:text-lg font-black uppercase tracking-wider text-muted-foreground truncate">
                {match.teamA || "Team A"}
              </div>
              <div className="text-5xl sm:text-7xl font-black font-mono text-primary drop-shadow-sm select-none">
                {scoreA}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-[1px] bg-border/60" />
              <div className="text-xs font-black text-muted-foreground/35 italic">VS</div>
              <div className="h-10 w-[1px] bg-border/60" />
            </div>

            <div className="text-center space-y-2.5 min-w-0">
              <div className="text-sm sm:text-lg font-black uppercase tracking-wider text-muted-foreground truncate">
                {match.teamB || "Team B"}
              </div>
              <div className="text-5xl sm:text-7xl font-black font-mono text-destructive drop-shadow-sm select-none">
                {scoreB}
              </div>
            </div>
          </div>
        </div>

        {/* Video Embeds section */}
        {isComplete && (vodEmbedUrl || highlightsEmbedUrl) ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Video className="h-4 w-4" /> Match Videos
              </h3>
              <div className="flex gap-2">
                {vodEmbedUrl && (
                  <Button
                    size="sm"
                    variant={activeVideoTab === "vod" ? "default" : "outline"}
                    onClick={() => setActiveVideoTab("vod")}
                    className="h-8 rounded-lg text-xs"
                  >
                    <Play className="h-3 w-3 mr-1" /> Full VOD
                  </Button>
                )}
                {highlightsEmbedUrl && (
                  <Button
                    size="sm"
                    variant={activeVideoTab === "highlights" ? "default" : "outline"}
                    onClick={() => setActiveVideoTab("highlights")}
                    className="h-8 rounded-lg text-xs"
                  >
                    <Star className="h-3 w-3 mr-1" /> Highlights
                  </Button>
                )}
              </div>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden border shadow-xl bg-black">
              {activeVideoTab === "vod" && vodEmbedUrl && (
                <iframe
                  src={vodEmbedUrl}
                  title="Full Trimmed Match VOD"
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )}
              {activeVideoTab === "highlights" && highlightsEmbedUrl && (
                <iframe
                  src={highlightsEmbedUrl}
                  title="Match Highlights Reel"
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )}
            </div>
          </div>
        ) : null}

        {/* Dynamic Player Stats & Events Timeline Grid */}
        <div className="grid md:grid-cols-5 gap-8">
          {/* Player Stats Table */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Player Stats (Dynamic)
            </h3>
            
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Player</th>
                    <th className="px-4 py-3 text-center">Team</th>
                    <th className="px-4 py-3 text-right">Points Played</th>
                    <th className="px-4 py-3 text-right">Highlights</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStatsList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-xs text-muted-foreground italic">
                        No player stats registered for this match.
                      </td>
                    </tr>
                  ) : (
                    playerStatsList.map((p) => (
                      <tr key={p.userId} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 flex items-center gap-2 font-medium">
                          <Avatar className="h-7 w-7 border">
                            {p.photoURL && <AvatarImage src={p.photoURL} alt={p.displayName} />}
                            <AvatarFallback className="text-[10px] bg-primary/20 text-primary-foreground font-black">
                              {getInitials(p.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[130px] sm:max-w-none">{p.displayName}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            p.team === "A" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                          )}>
                            Team {p.team}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold font-mono tabular-nums text-muted-foreground">
                          {p.pointsPlayed}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.highlightsReceived > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-yellow-500 font-mono">
                              <Star className="h-3 w-3 fill-current" /> {p.highlightsReceived}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Events Timeline */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Volleyball className="h-4 w-4" /> Rally Timeline
            </h3>

            <div className="bg-card border rounded-2xl p-4 shadow-sm max-h-[380px] overflow-y-auto space-y-3 custom-scrollbar">
              {events.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground italic">
                  No events recorded.
                </div>
              ) : (
                events.map((e, idx) => {
                  const isPoint = e.type === "point";
                  const isServe = e.type === "serve";

                  return (
                    <div
                      key={e.id || idx}
                      className={cn(
                        "relative flex gap-3 pb-3 border-l-2 pl-4 transition-colors last:pb-0 last:border-l-0",
                        isPoint ? "border-primary/20" : "border-amber-400/20"
                      )}
                    >
                      {/* Timeline dot */}
                      <div className={cn(
                        "absolute -left-[7px] top-1 h-3 w-3 rounded-full border bg-background",
                        isPoint ? "border-primary bg-primary" : "",
                        isServe ? "border-amber-400 bg-amber-400" : ""
                      )} />

                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                          <span>{formatTime(e.timestamp)}</span>
                          <span className="font-bold text-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                            {e.scoreA} - {e.scoreB}
                          </span>
                        </div>
                        
                        <div className="text-xs font-semibold">
                          {isServe && (
                            <span className="text-amber-500">
                              🏐 Team {e.servingTeam || "A"} Served
                            </span>
                          )}
                          {isPoint && (
                            <span className="text-foreground">
                              🔥 Point scored by Team {e.team}
                            </span>
                          )}
                        </div>

                        {isPoint && e.isHighlight && (
                          <div className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-500/20">
                            <Star className="h-3 w-3 fill-current" />
                            Highlight
                            {e.highlightPlayerName && ` · ${e.highlightPlayerName}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
