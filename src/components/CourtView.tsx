import { useState } from "react";
import { Volleyball, Shield } from "lucide-react";
import { getCourtPosition } from "@/lib/match-logic";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MatchPlayer {
  userId: string;
  displayName: string;
  photoURL?: string;
}

interface TeamState {
  name: string;
  players: MatchPlayer[];
  positions: string[]; // [P1, P2, P3, P4] userIds
}

interface CourtViewProps {
  teamA: TeamState;
  teamB: TeamState;
  servingTeam?: "A" | "B";
  interactive?: boolean;
  onReorder?: (team: "A" | "B", newPositions: string[]) => void;
  className?: string;
}

export function CourtView({
  teamA,
  teamB,
  servingTeam,
  interactive = false,
  onReorder,
  className,
}: CourtViewProps) {
  const [draggedInfo, setDraggedInfo] = useState<{ team: "A" | "B"; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{ team: "A" | "B"; index: number } | null>(null);

  // Helper to get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // Helper to format name (e.g. "Alex Hu" -> "Alex H.")
  const formatDisplayName = (name: string) => {
    const parts = name.split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return name;
  };

  const handleDragStart = (team: "A" | "B", index: number, e: React.DragEvent) => {
    if (!interactive) return;
    setDraggedInfo({ team, index });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (team: "A" | "B", index: number, e: React.DragEvent) => {
    if (!interactive || !draggedInfo || draggedInfo.team !== team) return;
    e.preventDefault();
    if (dragOverIndex?.team !== team || dragOverIndex?.index !== index) {
      setDragOverIndex({ team, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (team: "A" | "B", index: number, e: React.DragEvent) => {
    if (!interactive || !draggedInfo || draggedInfo.team !== team || draggedInfo.index === index) {
      setDraggedInfo(null);
      setDragOverIndex(null);
      return;
    }
    e.preventDefault();

    const newPositions = [...(team === "A" ? teamA.positions : teamB.positions)];
    // Swap the players at draggedInfo.index and index
    const temp = newPositions[draggedInfo.index];
    newPositions[draggedInfo.index] = newPositions[index];
    newPositions[index] = temp;

    if (onReorder) {
      onReorder(team, newPositions);
    }

    setDraggedInfo(null);
    setDragOverIndex(null);
  };

  // Render a 2x2 grid of players for a specific team
  const renderTeamCourt = (team: "A" | "B") => {
    const state = team === "A" ? teamA : teamB;
    const isServing = servingTeam === team;

    // Create a 2x2 grid representing row & col
    // A 2D array: grid[row][col] = player index (0..3)
    const grid: number[][] = [
      [-1, -1],
      [-1, -1],
    ];

    for (let i = 0; i < state.positions.length; i++) {
      const { row, col } = getCourtPosition(team, i);
      grid[row][col] = i;
    }

    return (
      <div className="relative w-full h-[180px] sm:h-[220px] grid grid-rows-2 gap-3 p-4">
        {grid.map((rowArr, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-2 gap-3">
            {rowArr.map((posIndex, colIndex) => {
              if (posIndex === -1) return <div key={colIndex} />;

              const userId = state.positions[posIndex];
              const player = state.players.find((p) => p.userId === userId);
              const isPlayerServing = isServing && posIndex === 0; // P1 (index 0) serves
              const isOver = dragOverIndex?.team === team && dragOverIndex?.index === posIndex;
              const isDragged = draggedInfo?.team === team && draggedInfo?.index === posIndex;

              return (
                <div
                  key={posIndex}
                  draggable={interactive}
                  onDragStart={(e) => handleDragStart(team, posIndex, e)}
                  onDragOver={(e) => handleDragOver(team, posIndex, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(team, posIndex, e)}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 select-none",
                    interactive ? "cursor-grab active:cursor-grabbing hover:scale-[1.02]" : "",
                    isDragged ? "opacity-40 scale-95" : "",
                    isOver ? "bg-primary/20 border-2 border-dashed border-primary shadow-lg" : "bg-black/45 border border-white/10 backdrop-blur-md",
                    isPlayerServing
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-green-800 shadow-[0_0_15px_rgba(251,191,36,0.5)] border-amber-400/50"
                      : "",
                    "h-full w-full"
                  )}
                >
                  {/* Position Badge */}
                  <div className="absolute top-1.5 left-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white/50 tracking-wider font-mono">
                      P{posIndex + 1}
                    </span>
                    {isPlayerServing && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </div>

                  {/* Serve Ball Icon */}
                  {isPlayerServing && (
                    <div className="absolute top-1.5 right-2 text-amber-400 animate-pulse">
                      <Volleyball className="h-3.5 w-3.5" />
                    </div>
                  )}

                  {/* Player Info */}
                  <div className="flex flex-col items-center gap-1.5">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-white/10 shadow-md">
                      {player?.photoURL ? (
                        <AvatarImage src={player.photoURL} alt={player.displayName} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary-glow text-white text-xs font-semibold">
                        {player ? getInitials(player.displayName) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    
                    <span className="text-xs sm:text-sm font-semibold text-white tracking-tight text-center truncate max-w-[110px] drop-shadow-sm">
                      {player ? formatDisplayName(player.displayName) : "Empty"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-gradient-to-b from-green-700 to-emerald-800",
        className
      )}
    >
      {/* Court Grid Overlay Lines */}
      <div className="absolute inset-0 pointer-events-none border-[3px] border-white/20 m-2 rounded-xl flex flex-col justify-between">
        {/* Net Line Divider */}
        <div className="w-full border-t-[2px] border-dashed border-white/40 absolute top-1/2 left-0 transform -translate-y-1/2 z-10" />
      </div>

      {/* Net Mesh Overlay */}
      <div className="absolute top-1/2 left-2 right-2 -translate-y-1/2 h-4 z-20 flex items-center pointer-events-none">
        <div className="w-full h-1 bg-neutral-900 shadow-md flex items-center justify-center">
          <div className="h-3 w-full bg-[linear-gradient(90deg,transparent_0px,transparent_4px,rgba(255,255,255,0.15)_4px,rgba(255,255,255,0.15)_8px)] bg-[size:8px_100%]" />
        </div>
      </div>

      {/* Roster / Courts */}
      <div className="flex flex-col justify-between relative z-10 h-[360px] sm:h-[440px]">
        {/* Team A Court (Top) */}
        <div className="relative flex flex-col justify-end h-[50%]">
          <div className="absolute top-4 left-6 text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
            <Shield className="h-3 w-3" /> {teamA.name || "Team A"}
          </div>
          {renderTeamCourt("A")}
        </div>

        {/* Team B Court (Bottom) */}
        <div className="relative flex flex-col justify-start h-[50%]">
          <div className="absolute bottom-4 left-6 text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
            <Shield className="h-3 w-3" /> {teamB.name || "Team B"}
          </div>
          {renderTeamCourt("B")}
        </div>
      </div>
    </div>
  );
}
