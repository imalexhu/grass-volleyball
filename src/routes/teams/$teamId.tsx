import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeam, removeTeamMember, getMatchesByTeam, disbandTeam } from "@/lib/api";
import { RosterGrid } from "@/components/RosterGrid";
import { AddMemberDialog } from "@/components/AddMemberDialog";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, Crown, Trash2, Loader2, Play, Youtube, Trophy, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match } from "@/lib/types";

export const Route = createFileRoute("/teams/$teamId")({
  component: TeamDetail,
});

function TeamDetail() {
  const { teamId } = Route.useParams();
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: team, isLoading: loadingTeam } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => getTeam(teamId),
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["team-matches", teamId],
    queryFn: () => {
      if (!team) return [];
      return getMatchesByTeam(team.name);
    },
    enabled: !!team,
  });

  const isCaptain = user?.uid === team?.captainId;

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      queryClient.invalidateQueries({ queryKey: ["user-teams"] });
      toast.success("Member removed");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  const disbandMutation = useMutation({
    mutationFn: () => disbandTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-teams"] });
      toast.success("Team disbanded");
      navigate({ to: "/teams" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to disband team");
    },
  });

  const handleRemove = (userId: string) => {
    if (window.confirm("Remove this member from the team?")) {
      removeMutation.mutate(userId);
    }
  };

  const handleDisband = () => {
    if (window.confirm("Disband this team? This cannot be undone. All members will be removed.")) {
      disbandMutation.mutate();
    }
  };

  if (loadingTeam) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-10">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-20 text-center">
        <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Team Not Found</h1>
        <p className="text-muted-foreground mb-6">This team doesn't exist or has been disbanded.</p>
        <Button asChild variant="outline">
          <Link to="/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  const captainName = team.members.find(m => m.userId === team.captainId)?.displayName || "Captain";

  // Compute stats
  const wins = matches.filter(m => {
    if (m.status !== "complete") return false;
    const isTeamA = m.teamA === team.name;
    return isTeamA ? (m.scoreA || 0) > (m.scoreB || 0) : (m.scoreB || 0) > (m.scoreA || 0);
  }).length;
  const losses = matches.length - wins;

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
        <Link to="/teams"><ArrowLeft className="h-4 w-4 mr-2" /> All Teams</Link>
      </Button>

      {/* Team Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold tracking-tight">{team.name}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border">
              {team.members.length}/4
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-yellow-500" /> {captainName}
            </span>
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" /> {wins}W / {losses}L
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {isCaptain && team.members.length < 4 && (
            <AddMemberDialog teamId={teamId} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["team", teamId] })} />
          )}
          {isCaptain && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-border hover:bg-destructive/10"
              onClick={handleDisband}
              disabled={disbandMutation.isPending}
            >
              {disbandMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Roster */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Roster</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-bold">
            {team.members.length}/4 filled
          </span>
        </div>
        <RosterGrid team={team} currentUserId={user?.uid} onRemove={isCaptain ? handleRemove : undefined} />
      </section>

      {/* Match History */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Match History</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-bold">{matches.length} matches</span>
        </div>

        {loadingMatches ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : matches.length > 0 ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Opponent</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Score</th>
                  <th className="px-4 py-3 text-right font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {matches.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).map(m => {
                  const isTeamA = m.teamA === team.name;
                  const opponent = isTeamA ? m.teamB : m.teamA;
                  const won = m.status === "complete" && (
                    (isTeamA && (m.scoreA || 0) > (m.scoreB || 0)) ||
                    (!isTeamA && (m.scoreB || 0) > (m.scoreA || 0))
                  );
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{opponent}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(m.scheduledAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {m.status === "complete" ? `${m.scoreA}–${m.scoreB}` : <span className="text-muted-foreground italic text-xs">{m.status}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.status === "complete" ? (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            won ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          }`}>
                            {won ? "Win" : "Loss"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">No matches yet</p>
            <p className="text-xs mt-1">Matches will appear once the team registers for a tournament.</p>
          </div>
        )}
      </section>
    </div>
  );
}