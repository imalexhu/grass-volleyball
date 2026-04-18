import { Calendar, MapPin, Users, Trophy } from "lucide-react";
import type { Tournament } from "@/lib/types";
import { statusLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<Tournament["status"], string> = {
  open: "bg-primary/15 text-primary border-primary/30",
  full: "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-destructive/15 text-destructive border-destructive/30 animate-pulse",
  complete: "bg-muted text-muted-foreground border-border",
};

export function TournamentCard({
  tournament,
  onClick,
}: {
  tournament: Tournament;
  onClick: () => void;
}) {
  const filled = tournament.registeredTeams?.length || 0;
  const pct = (filled / tournament.maxTeams) * 100;

  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-glow overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex items-start justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            statusStyles[tournament.status],
          )}
        >
          {tournament.status === "in_progress" && (
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
          )}
          {statusLabel[tournament.status]}
        </span>
      </div>

      <h3 className="relative text-lg font-semibold tracking-tight mb-1 group-hover:text-primary transition-colors">
        {tournament.name}
      </h3>
      <p className="relative text-xs text-muted-foreground mb-4">{tournament.format}</p>

      <div className="relative space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {new Date(tournament.dateStart).toLocaleDateString("en-AU", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{tournament.location}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>
            {filled} / {tournament.maxTeams} teams
          </span>
        </div>
      </div>

      <div className="relative mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="relative mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Entry</span>
        <span className="text-sm font-semibold">${tournament.entryFee}</span>
      </div>
    </button>
  );
}
