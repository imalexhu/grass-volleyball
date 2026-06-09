import { Crown } from "lucide-react";
import type { TeamDoc, TeamMember } from "@/lib/types";

export function RosterGrid({
  team,
  currentUserId,
  onRemove,
}: {
  team: TeamDoc;
  currentUserId?: string;
  onRemove?: (userId: string) => void;
}) {
  const isCaptain = currentUserId === team.captainId;

  return (
    <div className="grid grid-cols-2 gap-3">
      {team.members.map((m) => (
        <RosterSlot
          key={m.userId}
          member={m}
          isCaptain={m.userId === team.captainId}
          canRemove={isCaptain && m.userId !== team.captainId}
          onRemove={() => onRemove?.(m.userId)}
        />
      ))}
      {Array.from({ length: Math.max(0, 4 - team.members.length) }).map((_, i) => (
        <EmptySlot key={`empty-${i}`} />
      ))}
    </div>
  );
}

function RosterSlot({
  member,
  isCaptain,
  canRemove,
  onRemove,
}: {
  member: TeamMember;
  isCaptain: boolean;
  canRemove: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card/40 p-4 flex items-center gap-3 group hover:border-primary/30 transition-all">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
        {member.displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate flex items-center gap-1.5">
          {member.displayName}
          {isCaptain && <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {isCaptain ? "Captain" : "Player"}
        </div>
      </div>
      {canRemove && onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-destructive hover:text-destructive/80 font-semibold uppercase tracking-wider"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="rounded-xl border-2 border-dashed border-border/50 bg-muted/10 p-4 flex items-center justify-center text-xs text-muted-foreground/50 italic">
      Open slot
    </div>
  );
}