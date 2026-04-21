import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ArrowLeft, Undo2, Video, Check, Save, Youtube, Zap, Radio, Trophy, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMatches, updateMatchResult } from "@/lib/api";
import type { Match, MatchEvent } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/score/$matchId")({
  component: ScorePad,
  head: () => ({ meta: [{ title: "Scoring — Adelaide Grass Volleyball" }] }),
});

function ScorePad() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [setNumber, setSetNumber] = useState(1);
  const [recording, setRecording] = useState(false);
  
  const [vodUrlA, setVodUrlA] = useState("");
  const [vodUrlB, setVodUrlB] = useState("");
  const [matchHighlightsUrl, setMatchHighlightsUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMatches().then(all => {
      const m = all.find(x => x.id === matchId);
      if (m) {
        setMatch(m);
        setVodUrlA(m.vodUrlA || "");
        setVodUrlB(m.vodUrlB || "");
        setMatchHighlightsUrl(m.matchHighlightsUrl || "");
        setEvents(m.events || []);
      }
    });
  }, [matchId]);

  if (!match) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading match data...</p>
      </div>
    </div>
  );

  const scoreA = events.length > 0 ? events[events.length - 1].scoreA : 0;
  const scoreB = events.length > 0 ? events[events.length - 1].scoreB : 0;

  const log = (type: "serve" | "point", team?: "A" | "B") => {
    const newScoreA = type === "point" && team === "A" ? scoreA + 1 : scoreA;
    const newScoreB = type === "point" && team === "B" ? scoreB + 1 : scoreB;
    
    const event: MatchEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      team,
      timestamp: Date.now(),
      scoreA: newScoreA,
      scoreB: newScoreB,
    };
    
    setEvents((e) => [...e, event]);
    
    if (type === "point") {
      // Subtle haptic feedback feel
    }
  };

  const undo = () => {
    if (events.length === 0) return;
    setEvents((e) => e.slice(0, -1));
    toast.info("Last action undone");
  };

  const handleFinalize = async () => {
    setSaving(true);
    try {
      await updateMatchResult(matchId, scoreA, scoreB, {
        vodUrlA,
        vodUrlB,
        matchHighlightsUrl,
        events,
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
        <button
          onClick={() => {
            setRecording(!recording);
            if (!recording) toast.success("Recording started");
            else toast.info("Recording paused");
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all shadow-sm",
            recording
              ? "border-destructive/40 bg-destructive/10 text-destructive ring-4 ring-destructive/5"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
          )}
        >
          <div className={cn(
            "h-2 w-2 rounded-full",
            recording ? "bg-destructive animate-pulse" : "bg-muted-foreground",
          )} />
          {recording ? "RECORDING" : "START REC"}
        </button>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Score display */}
        <div className="grid grid-cols-2 bg-card/50 backdrop-blur-sm relative overflow-hidden border-b border-border/50">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground">VS</div>
          </div>
          
          <div className="p-8 text-center relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 truncate px-2">{match.teamA}</div>
            <div className="text-8xl font-black tabular-nums tracking-tighter text-gradient-primary drop-shadow-sm">{scoreA}</div>
          </div>
          
          <div className="p-8 text-center relative group border-l border-border/50">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 truncate px-2">{match.teamB}</div>
            <div className="text-8xl font-black tabular-nums tracking-tighter text-gradient-primary drop-shadow-sm">{scoreB}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-6 space-y-4">
          <div className="flex gap-4">
            <button
              onClick={() => log("serve", "A")}
              className="flex-1 rounded-2xl border-2 border-dashed border-border bg-background py-6 flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] transition-all group"
            >
              <div className="p-2 rounded-full bg-muted group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <Radio className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary">Serve A</span>
            </button>
            <button
              onClick={() => log("serve", "B")}
              className="flex-1 rounded-2xl border-2 border-dashed border-border bg-background py-6 flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] transition-all group"
            >
              <div className="p-2 rounded-full bg-muted group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <Radio className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary">Serve B</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 h-48">
            <button
              onClick={() => log("point", "A")}
              className="group relative rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-glow p-[2px] transition-all active:scale-[0.97] hover:shadow-glow-sm"
            >
              <div className="h-full w-full rounded-[22px] bg-primary flex flex-col items-center justify-center gap-1">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Add Point</div>
                <div className="text-xl font-black text-white truncate max-w-full px-4">{match.teamA}</div>
                <Zap className="h-4 w-4 text-white/40 mt-1 group-active:scale-150 transition-transform" />
              </div>
            </button>
            
            <button
              onClick={() => log("point", "B")}
              className="group relative rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-glow p-[2px] transition-all active:scale-[0.97] hover:shadow-glow-sm"
            >
              <div className="h-full w-full rounded-[22px] bg-primary flex flex-col items-center justify-center gap-1">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Add Point</div>
                <div className="text-xl font-black text-white truncate max-w-full px-4">{match.teamB}</div>
                <Zap className="h-4 w-4 text-white/40 mt-1 group-active:scale-150 transition-transform" />
              </div>
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={undo}
              variant="outline"
              disabled={events.length === 0}
              className="flex-1 h-14 rounded-2xl border-border bg-card hover:bg-muted text-sm font-bold uppercase tracking-widest gap-2"
            >
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
            <Button
              onClick={() => {
                setSetNumber(s => s + 1);
                toast.success(`Set ${setNumber + 1} started`);
              }}
              variant="outline"
              className="flex-1 h-14 rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-bold uppercase tracking-widest gap-2"
            >
              <Check className="h-4 w-4" /> Next Set
            </Button>
          </div>

          {/* Collapsible History / Events */}
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
                <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed rounded-xl">No events recorded yet.</div>
              ) : (
                [...events].reverse().slice(0, 5).map((e, idx) => (
                  <div key={e.id} className="flex items-center justify-between text-[11px] bg-card/50 p-2 rounded-lg border border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono opacity-50">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={cn(
                        "font-bold uppercase tracking-tighter",
                        e.type === "point" ? "text-primary" : "text-muted-foreground"
                      )}>
                        {e.type} {e.team && `· Team ${e.team}`}
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
