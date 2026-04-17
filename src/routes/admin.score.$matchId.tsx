import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowLeft, Undo2, Video, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/score/$matchId")({
  component: ScorePad,
  head: () => ({ meta: [{ title: "Scoring — Adelaide Grass Volleyball" }] }),
});

type EventType = "recording_started" | "serve" | "point_team_a" | "point_team_b";

interface Event {
  id: number;
  type: EventType;
  ts: number;
}

function ScorePad() {
  const [events, setEvents] = useState<Event[]>([]);
  const [setNumber, setSetNumber] = useState(1);
  const [recording, setRecording] = useState(false);
  const teamA = "Spike Force";
  const teamB = "Net Ninjas";

  const log = (type: EventType) => {
    setEvents((e) => [...e, { id: Date.now(), type, ts: Date.now() }]);
    if (type === "recording_started") setRecording(true);
  };

  const undo = () => setEvents((e) => e.slice(0, -1));

  const scoreA = events.filter((e) => e.type === "point_team_a").length;
  const scoreB = events.filter((e) => e.type === "point_team_b").length;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border glass-strong">
        <Link to="/admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Exit
        </Link>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Court 1 · Set <span className="text-foreground font-semibold">{setNumber}</span>
        </div>
        <button
          onClick={() => log("recording_started")}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            recording
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-surface text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              recording ? "bg-destructive animate-pulse" : "bg-muted-foreground",
            )}
          />
          {recording ? "REC" : "Start REC"}
        </button>
      </header>

      {/* Score display */}
      <div className="grid grid-cols-2 border-b border-border">
        <div className="p-6 text-center border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 truncate">{teamA}</div>
          <div className="text-7xl font-bold tabular-nums text-gradient-primary">{scoreA}</div>
        </div>
        <div className="p-6 text-center bg-gradient-to-b from-primary/5 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 truncate">{teamB}</div>
          <div className="text-7xl font-bold tabular-nums text-gradient-primary">{scoreB}</div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        <button
          onClick={() => log("serve")}
          className="w-full rounded-2xl border border-border bg-surface py-5 text-base font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-[0.99] transition-all"
        >
          <Video className="inline h-4 w-4 mr-2" />
          Serve
        </button>

        <div className="grid grid-cols-2 gap-3 flex-1">
          <button
            onClick={() => log("point_team_a")}
            className="rounded-2xl bg-gradient-to-br from-primary/90 to-primary-glow text-primary-foreground font-bold uppercase tracking-wider shadow-glow active:scale-[0.98] transition-transform py-8"
          >
            <div className="text-xs opacity-80">Point</div>
            <div className="text-lg mt-1 truncate px-2">{teamA}</div>
          </button>
          <button
            onClick={() => log("point_team_b")}
            className="rounded-2xl bg-gradient-to-br from-primary/90 to-primary-glow text-primary-foreground font-bold uppercase tracking-wider shadow-glow active:scale-[0.98] transition-transform py-8"
          >
            <div className="text-xs opacity-80">Point</div>
            <div className="text-lg mt-1 truncate px-2">{teamB}</div>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={undo}
            variant="outline"
            className="h-14 border-border bg-surface text-base"
          >
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
          <Button
            onClick={() => setSetNumber((s) => s + 1)}
            variant="outline"
            className="h-14 border-primary/30 bg-primary/5 text-base"
          >
            <Check className="h-4 w-4" /> Next set
          </Button>
        </div>

        <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground pt-2">
          {events.length} event{events.length !== 1 && "s"} logged this match
        </div>
      </div>
    </div>
  );
}
