import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMatchesByTeam, getStandingsByTeam, getTeamInfo } from "@/lib/api";
import { Play, Youtube, Trophy, AlertCircle, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/team/$teamId")({
  component: TeamPage,
});

function TeamPage() {
  const { teamId } = Route.useParams();
  const teamName = decodeURIComponent(teamId);
  
  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["team-matches", teamName],
    queryFn: () => getMatchesByTeam(teamName),
  });

  const { data: standings = [], isLoading: loadingStandings } = useQuery({
    queryKey: ["team-standings", teamName],
    queryFn: () => getStandingsByTeam(teamName),
  });

  const { data: teamInfo, isLoading: loadingInfo } = useQuery({
    queryKey: ["team-info", teamName],
    queryFn: () => getTeamInfo(teamName),
  });

  if (loadingMatches || loadingStandings || loadingInfo) {
    return (
      <div className="flex-1 w-full max-w-5xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-muted-foreground">Loading team data...</p>
      </div>
    );
  }

  // Calculate stats
  let totalWins = 0;
  let totalLosses = 0;
  standings.forEach(s => {
    totalWins += s.won;
    totalLosses += s.lost;
  });

  // Recent VODs
  const vods = matches.filter(m => m.vodUrlA || m.vodUrlB || m.matchHighlightsUrl)
                      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                      .slice(0, 10);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-6">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
        <Link to="/home"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">{teamName}</h1>
          <p className="text-muted-foreground flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Captain: {teamInfo?.captain || "Unknown"}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-12">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Historic Record</span>
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{totalWins}</span>
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Wins</span>
            <span className="text-4xl font-bold text-muted-foreground/30 ml-2">-</span>
            <span className="text-4xl font-bold ml-2">{totalLosses}</span>
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Losses</span>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary" 
              style={{ width: `${totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Recent Matches & VODs</h2>
      </div>

      {matches.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Match</th>
                <th className="px-6 py-4 text-left font-semibold">Date</th>
                <th className="px-6 py-4 text-right font-semibold">Score</th>
                <th className="px-6 py-4 text-right font-semibold">Media</th>
              </tr>
            </thead>
            <tbody>
              {matches.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).map(m => {
                const isTeamA = m.teamA === teamName;
                const won = m.status === "complete" && (
                  (isTeamA && (m.scoreA || 0) > (m.scoreB || 0)) ||
                  (!isTeamA && (m.scoreB || 0) > (m.scoreA || 0))
                );
                
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-base">
                        {isTeamA ? (
                          <><span className="text-foreground">{m.teamA}</span> <span className="text-muted-foreground font-normal mx-1">vs</span> <span className="text-muted-foreground">{m.teamB}</span></>
                        ) : (
                          <><span className="text-foreground">{m.teamB}</span> <span className="text-muted-foreground font-normal mx-1">vs</span> <span className="text-muted-foreground">{m.teamA}</span></>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{m.stage} {m.pool && `· Pool ${m.pool}`}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(m.scheduledAt).toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {m.status === "complete" ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-base">{m.scoreA} - {m.scoreB}</span>
                          <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${won ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                            {won ? 'Win' : 'Loss'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{m.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {m.vodUrlA && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10" title="VOD A" asChild>
                            <a href={m.vodUrlA} target="_blank" rel="noreferrer"><Play className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {m.vodUrlB && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-secondary hover:text-secondary hover:bg-secondary/10" title="VOD B" asChild>
                            <a href={m.vodUrlB} target="_blank" rel="noreferrer"><Play className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {m.matchHighlightsUrl && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title="Highlights" asChild>
                            <a href={m.matchHighlightsUrl} target="_blank" rel="noreferrer"><Youtube className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {(!m.vodUrlA && !m.vodUrlB && !m.matchHighlightsUrl) && (
                          <span className="text-xs text-muted-foreground italic py-1">No media</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground flex flex-col items-center">
          <AlertCircle className="h-10 w-10 mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No matches found</h3>
          <p className="text-sm">This team hasn't played any matches yet.</p>
        </div>
      )}
    </div>
  );
}
