import { Link } from "@tanstack/react-router";
import { Users, Crown } from "lucide-react";
import type { TeamDoc } from "@/lib/types";

export function TeamCard({ team }: { team: TeamDoc }) {
  const slots = team.members.length;
  const captainName = team.members.find(m => m.userId === team.captainId)?.displayName || "—";

  return (
    <Link
      to="/teams/$teamId"
      params={{ teamId: team.id }}
      className="group block rounded-2xl border border-border bg-card/40 hover:bg-card/60 hover:border-primary/40 transition-all shadow-sm"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors">
            {team.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums">{slots}/4</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Crown className="h-3.5 w-3.5 text-yellow-500" />
          <span>{captainName}</span>
        </div>

        {/* Member avatars row */}
        <div className="flex -space-x-2">
          {team.members.map((m) => (
            <div
              key={m.userId}
              className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary"
              title={m.displayName}
            >
              {m.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - slots) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="h-8 w-8 rounded-full border-2 border-dashed border-border/50 bg-muted/20 flex items-center justify-center text-[10px] text-muted-foreground/30"
            >
              ?
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}