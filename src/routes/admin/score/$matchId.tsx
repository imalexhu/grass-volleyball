import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Match, MatchEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ArrowLeft, Undo2, Video, Check, Save, Youtube, Zap, Radio, Trophy, History, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { startMatch, subscribeToMatch, updateMatchResult, updateMatchLiveScore, updateMatchEvents } from "@/lib/api";

export const Route = createFileRoute("/admin/score/$matchId")({
  component: ScorePad,
  head: () => ({ meta: [{ title: "Scoring — Adelaide Grass Volleyball" }] }),
});

function ScorePad() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [setHistory, setSetHistory] = useState<{A: number, B: number}[]>([]);
  const [setNumber, setSetNumber] = useState(1);
  const [rallyInProgress, setRallyInProgress] = useState(false);
  
  const [vodUrlA, setVodUrlA] = useState("");
  const [vodUrlB, setVodUrlB] = useState("");
  const [matchHighlightsUrl, setMatchHighlightsUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeToMatch(matchId, (m) => {
      setMatch(m);
      if (m.vodUrlA) setVodUrlA(m.vodUrlA);
      if (m.vodUrlB) setVodUrlB(m.vodUrlB);
      if (m.matchHighlightsUrl) setMatchHighlightsUrl(m.matchHighlightsUrl);
      if (m.events) {
        setEvents(m.events);
        const last = m.events[m.events.length - 1];
        setRallyInProgress(last.type === "serve");
      }
    });
  }, [matchId]);

  const [checklist, setChecklist] = useState({
    recording: false,
    ready: false
  });

  const handleStartMatch = async () => {
    if (!checklist.recording || !checklist.ready) {
      toast.error("Please confirm all checklist items first");
      return;
    }
    try {
      await startMatch(matchId);
      toast.success("Match is now LIVE!");
    } catch (err) {
      toast.error("Failed to start match");
    }
  };

  if (!match) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading match data...</p>
      </div>
    </div>
  );

  // Filter events for the current set
  const currentSetEvents = events.filter(e => e.setIndex === setNumber || (!e.setIndex && setNumber === 1));

  const scoreA = currentSetEvents.length > 0 ? currentSetEvents[currentSetEvents.length - 1].scoreA : 0;
  const scoreB = currentSetEvents.length > 0 ? currentSetEvents[currentSetEvents.length - 1].scoreB : 0;

  const setsWonA = setHistory.filter(s => s.A > s.B).length;
  const setsWonB = setHistory.filter(s => s.B > s.A).length;

  const highlightsInSet = currentSetEvents.filter(e => e.isHighlight).length;

  const handleHighlight = async () => {
    if (highlightsInSet >= 5) {
      toast.error("Maximum 5 highlights per set reached");
      return;
    }

    if (events.length === 0) {
      toast.error("No events to highlight");
      return;
    }

    const lastPointIdx = events.findLastIndex(e => e.type === "point");
    if (lastPointIdx === -1) {
      toast.error("No points to highlight");
      return;
    }

    const lastEvent = events[lastPointIdx];
    if (lastEvent.isHighlight) {
      toast.info("Latest event is already a highlight");
      return;
    }

    try {
      const updatedEvents = [...events];
      updatedEvents[lastPointIdx] = { ...updatedEvents[lastPointIdx], isHighlight: true };
      
      setEvents(updatedEvents);
      await updateMatchEvents(matchId, updatedEvents);
      toast.success("Point marked as highlight! ⭐");
    } catch (err) {
      console.error("Failed to mark highlight:", err);
    }
  };

  const log = async (type: "serve" | "point" | "set-finish", team?: "A" | "B") => {
    if (match.status !== "live") {
      toast.error("Match must be started before scoring");
      return;
    }

    const newScoreA = type === "point" && team === "A" ? scoreA + 1 : scoreA;
    const newScoreB = type === "point" && team === "B" ? scoreB + 1 : scoreB;
    
    const event: MatchEvent = {
      id: Math.random().toString(36).substring(2, 11),
      type,
      timestamp: Date.now(),
      scoreA: newScoreA,
      scoreB: newScoreB,
      setIndex: setNumber
    };
    
    if (team) {
      event.team = team;
    }
    
    const updatedEvents = [...events, event];
    setEvents(updatedEvents);
    if (type === "serve") setRallyInProgress(true);
    if (type === "point") setRallyInProgress(false);

    // Sync to Firestore for live updates
    try {
      await updateMatchLiveScore(matchId, newScoreA, newScoreB, updatedEvents);
    } catch (err) {
      console.error("Failed to sync score:", err);
    }

    return updatedEvents;
  };

  const undo = async () => {
    if (events.length === 0) return;
    const lastEvent = events[events.length - 1];
    const updatedEvents = events.slice(0, -1);
    setEvents(updatedEvents);
    
    // Calculate new current score from history
    const currentSetEvents = updatedEvents.filter(e => e.setIndex === setNumber || (!e.setIndex && setNumber === 1));
    const newScoreA = currentSetEvents.length > 0 ? currentSetEvents[currentSetEvents.length - 1].scoreA : 0;
    const newScoreB = currentSetEvents.length > 0 ? currentSetEvents[currentSetEvents.length - 1].scoreB : 0;

    // Reverse rally state and set state
    if (lastEvent.type === "serve") {
      setRallyInProgress(false);
    } else if (lastEvent.type === "point") {
      setRallyInProgress(true);
    } else if (lastEvent.type === "set-finish") {
      setSetHistory((h) => h.slice(0, -1));
      setSetNumber((s) => s - 1);
      setRallyInProgress(false);
    }
    
    try {
      await updateMatchLiveScore(matchId, newScoreA, newScoreB, updatedEvents);
    } catch (err) {
      console.error("Failed to sync undo:", err);
    }

    toast.info("Last action undone");
  };

  const handleNextSet = async () => {
    const nextEvents = await log("set-finish");
    setSetHistory([...setHistory, { A: scoreA, B: scoreB }]);
    setSetNumber(s => s + 1);
    setRallyInProgress(false);

    try {
      await updateMatchLiveScore(matchId, 0, 0, nextEvents);
    } catch (err) {
      console.error("Failed to reset live score:", err);
    }

    toast.success(`Set ${setNumber} finished: ${scoreA}-${scoreB}`);
  };

  const handleFinalize = async () => {
    setSaving(true);
    // Include current set if it has scores
    const finalSetHistory = [...setHistory];
    if (scoreA > 0 || scoreB > 0) {
      finalSetHistory.push({ A: scoreA, B: scoreB });
    }

    const finalSetsA = finalSetHistory.filter(s => s.A > s.B).length;
    const finalSetsB = finalSetHistory.filter(s => s.B > s.A).length;

    try {
      await updateMatchResult(matchId, finalSetsA, finalSetsB, {
        vodUrlA,
        vodUrlB,
        matchHighlightsUrl,
        events, // All match events
      });
      toast.success("Match finalized successfully");
      navigate({ to: "/admin" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save match results");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      {/* Start Match Overlay */}
      {match.status === "scheduled" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md px-4">
          <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl text-center">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-black mb-2">Ready to Start?</h2>
            <p className="text-muted-foreground mb-8">Before making this match live, please confirm the following:</p>
            
            <div className="space-y-4 mb-8 text-left">
              <div 
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
                  checklist.recording ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-border/50"
                )}
                onClick={() => setChecklist(c => ({...c, recording: !c.recording}))}
              >
                <Checkbox checked={checklist.recording} onCheckedChange={(v) => setChecklist(c => ({...c, recording: !!v}))} />
                <div className="space-y-1">
                  <div className="text-sm font-bold">Phone is recording</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">Make sure the phone is positioned correctly and recording in landscape.</p>
                </div>
              </div>
              <div 
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
                  checklist.ready ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-border/50"
                )}
                onClick={() => setChecklist(c => ({...c, ready: !c.ready}))}
              >
                <Checkbox checked={checklist.ready} onCheckedChange={(v) => setChecklist(c => ({...c, ready: !!v}))} />
                <div className="space-y-1">
                  <div className="text-sm font-bold">Participants ready</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">Both teams have arrived at Court {match.court} and are ready to play.</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleStartMatch}
              disabled={!checklist.recording || !checklist.ready}
              className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl shadow-glow disabled:opacity-50"
            >
              START MATCH & GO LIVE
            </Button>
            <Link to="/admin" className="block mt-6 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hover:text-foreground transition-colors">
              Exit to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-20">
        <Link 
          to="/admin" 
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="p-1.5 rounded-lg group-hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Exit
        </Link>
        <div className="flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-0.5">
            Court {match.court}
          </div>
          <div className="text-xs font-bold bg-primary/10 text-primary px-3 py-0.5 rounded-full border border-primary/20">
            Set {setNumber}
          </div>
        </div>
        <div className="w-20" /> {/* Spacer to balance header */}
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Match Score (Sets) */}
        <div className="flex justify-center gap-8 py-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Sets</span>
            <div className="text-2xl font-black text-primary">{setsWonA}</div>
          </div>
          <div className="flex flex-col items-center justify-center opacity-30 italic text-[10px] font-bold">MATCH SCORE</div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Sets</span>
            <div className="text-2xl font-black text-primary">{setsWonB}</div>
          </div>
        </div>

        {/* Current Set Display */}
        <div className="grid grid-cols-2 bg-card/50 backdrop-blur-sm relative overflow-hidden border-b border-border/50">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground shadow-xl">VS</div>
          </div>
          
          <div className="p-8 pb-10 text-center relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 truncate px-2">{match.teamA}</div>
            <div className="text-8xl font-black tabular-nums tracking-tighter text-gradient-primary drop-shadow-sm">{scoreA}</div>
          </div>
          
          <div className="p-8 pb-10 text-center relative group border-l border-border/50">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 truncate px-2">{match.teamB}</div>
            <div className="text-8xl font-black tabular-nums tracking-tighter text-gradient-primary drop-shadow-sm">{scoreB}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-6 space-y-4">
          <div className="flex justify-center">
            <button
              onClick={() => log("serve")}
              disabled={rallyInProgress}
              className={cn(
                "w-full max-w-sm rounded-2xl border-2 border-dashed py-5 flex flex-col items-center justify-center gap-2 transition-all group",
                rallyInProgress 
                  ? "border-muted bg-muted/20 opacity-50 cursor-not-allowed" 
                  : "border-primary bg-primary/5 hover:bg-primary/10 active:scale-[0.98]"
              )}
            >
              <div className={cn(
                "p-2 rounded-full transition-colors",
                rallyInProgress ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary group-hover:bg-primary/30"
              )}>
                <Radio className="h-5 w-5" />
              </div>
              <span className={cn(
                "text-xs font-bold uppercase tracking-widest transition-colors",
                rallyInProgress ? "text-muted-foreground" : "text-primary"
              )}>
                {rallyInProgress ? "Rally in Progress..." : "Start Rally / Serve"}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 h-48">
            <button
              onClick={() => log("point", "A")}
              disabled={!rallyInProgress}
              className={cn(
                "group relative rounded-3xl p-[2px] transition-all",
                rallyInProgress 
                  ? "bg-gradient-to-br from-primary via-primary to-primary-glow active:scale-[0.97] hover:shadow-glow-sm" 
                  : "bg-muted opacity-40 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "h-full w-full rounded-[22px] flex flex-col items-center justify-center gap-1",
                rallyInProgress ? "bg-primary" : "bg-muted"
              )}>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/60">Add Point</div>
                <div className="text-xl font-black text-primary-foreground truncate max-w-full px-4">{match.teamA}</div>
                <Zap className="h-4 w-4 text-primary-foreground/40 mt-1 group-active:scale-150 transition-transform" />
              </div>
            </button>
            
            <button
              onClick={() => log("point", "B")}
              disabled={!rallyInProgress}
              className={cn(
                "group relative rounded-3xl p-[2px] transition-all",
                rallyInProgress 
                  ? "bg-gradient-to-br from-primary via-primary to-primary-glow active:scale-[0.97] hover:shadow-glow-sm" 
                  : "bg-muted opacity-40 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "h-full w-full rounded-[22px] flex flex-col items-center justify-center gap-1",
                rallyInProgress ? "bg-primary" : "bg-muted"
              )}>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/60">Add Point</div>
                <div className="text-xl font-black text-primary-foreground truncate max-w-full px-4">{match.teamB}</div>
                <Zap className="h-4 w-4 text-primary-foreground/40 mt-1 group-active:scale-150 transition-transform" />
              </div>
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-3">
              <Button
                onClick={handleHighlight}
                disabled={highlightsInSet >= 5 || events.length === 0 || events[events.length - 1].isHighlight}
                variant="outline"
                className={cn(
                  "flex-1 h-16 rounded-2xl border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-500 text-sm font-black uppercase tracking-widest gap-2 shadow-glow-sm",
                  (highlightsInSet >= 5 || events.length === 0 || (events.length > 0 && events[events.length - 1].isHighlight)) && "opacity-50 grayscale"
                )}
              >
                <Star className={cn("h-4 w-4", highlightsInSet < 5 && "fill-yellow-500")} /> 
                Highlight ({5 - highlightsInSet} left)
              </Button>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={undo}
                variant="outline"
                disabled={events.length === 0}
                className="flex-1 h-14 rounded-2xl border-border bg-card hover:bg-muted text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Undo2 className="h-4 w-4" /> Undo
              </Button>
              <Button
                onClick={handleNextSet}
                variant="outline"
                className="flex-1 h-14 rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Check className="h-4 w-4" /> Next Set
              </Button>
            </div>
          </div>

          {/* History / Events */}
          <div className="pt-6 border-t border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <History className="h-3 w-3" /> Recent Events
              </h3>
              <span className="text-[10px] font-medium text-muted-foreground tracking-tighter bg-muted px-2 py-0.5 rounded-md">
                {events.length} LOGS
              </span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {events.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed rounded-xl">No events in this set.</div>
              ) : (
                [...events].reverse().slice(0, 5).map((e, idx) => (
                  <div key={e.id} className="flex items-center justify-between text-[11px] bg-card/50 p-2 rounded-lg border border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono opacity-50">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={cn(
                        "font-bold uppercase tracking-tighter flex items-center gap-1",
                        e.type === "point" ? "text-primary" : "text-muted-foreground"
                      )}>
                        Set {(e as any).setIndex || 1} · {e.type} {e.team && `· Team ${e.team}`}
                        {e.isHighlight && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                      </span>
                    </div>
                    <div className="font-black tabular-nums">
                      {e.scoreA} - {e.scoreB}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Media & Finalize */}
          <div className="pt-8 space-y-6 border-t border-border/50 pb-12">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Video className="h-3 w-3" /> Post-Match Media
            </h3>
            
            <div className="grid gap-4">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                  <Youtube className="h-4 w-4" />
                </div>
                <Input 
                  value={vodUrlA} 
                  onChange={(e) => setVodUrlA(e.target.value)} 
                  placeholder="Team A VOD Link" 
                  className="bg-card border-border h-11 text-xs pl-10 rounded-xl focus:ring-primary/20"
                />
              </div>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                  <Youtube className="h-4 w-4" />
                </div>
                <Input 
                  value={vodUrlB} 
                  onChange={(e) => setVodUrlB(e.target.value)} 
                  placeholder="Team B VOD Link" 
                  className="bg-card border-border h-11 text-xs pl-10 rounded-xl focus:ring-primary/20"
                />
              </div>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-destructive transition-colors">
                  <Youtube className="h-4 w-4" />
                </div>
                <Input 
                  value={matchHighlightsUrl} 
                  onChange={(e) => setMatchHighlightsUrl(e.target.value)} 
                  placeholder="Match Highlights URL" 
                  className="bg-card border-border h-11 text-xs pl-10 rounded-xl focus:ring-destructive/20"
                />
              </div>
            </div>

            <Button 
              onClick={handleFinalize}
              disabled={saving}
              className="w-full h-16 bg-success text-success-foreground hover:bg-success/90 font-black text-lg shadow-glow mt-4 rounded-2xl group transition-all active:scale-[0.98]"
            >
              {saving ? (
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  SAVING...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                  FINALIZE MATCH
                </div>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
