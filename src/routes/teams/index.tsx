import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getUserTeams } from "@/lib/api";
import { TeamCard } from "@/components/TeamCard";
import { CreateTeamDialog } from "@/components/CreateTeamDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/teams/")({
  component: TeamsIndex,
  head: () => ({ meta: [{ title: "My Teams — Adelaide Grass Volleyball" }] }),
});

function TeamsIndex() {
  const { user } = useAuth();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["user-teams"],
    queryFn: () => (user ? getUserTeams(user.uid) : []),
    enabled: !!user,
  });

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
        <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
      </Button>

      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-primary mb-1">Teams</div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">My Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {teams.length} {teams.length === 1 ? "team" : "teams"} · max 3 teams per player
          </p>
        </div>
        {teams.length < 3 && <CreateTeamDialog />}
      </div>

      {teams.length >= 3 && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 flex items-center gap-2">
          <span className="font-semibold">Team limit reached.</span>
          <span>You're on 3 teams max. Remove a member or disband a team to create a new one.</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border p-5 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
              <div className="flex -space-x-2 mt-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : teams.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border">
          <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight mb-2">No teams yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create a team to start playing in tournaments. You'll be the captain and can add teammates.
          </p>
          <CreateTeamDialog />
        </div>
      )}
    </div>
  );
}