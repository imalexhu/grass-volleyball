import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTournaments, getMatches } from "@/lib/api";
import { TournamentCard } from "@/components/TournamentCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Trophy, Calendar, Settings, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  const { data: tournaments = [], isLoading: isLoadingTournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
    enabled: !!user,
  });

  const { data: allMatches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ["matches"],
    queryFn: () => getMatches(),
    enabled: !!user,
  });

  const myTournaments = useMemo(() => {
    if (!user) return [];
    return tournaments.filter(t => 
      t.registeredTeams?.some(team => 
        team.captain === user.displayName || 
        team.captain === user.email ||
        (user.displayName && team.name.toLowerCase().includes(user.displayName.toLowerCase()))
      )
    );
  }, [tournaments, user]);

  const myMatches = useMemo(() => {
    if (!user) return [];
    // Just a rough guess for mock data
    return allMatches.filter(m => 
      (user.displayName && (m.teamA.includes(user.displayName) || m.teamB.includes(user.displayName))) ||
      (user.email && (m.teamA.includes(user.email) || m.teamB.includes(user.email))) ||
      // Or matches from my tournaments
      myTournaments.some(t => t.id === m.tournamentId)
    );
  }, [allMatches, user, myTournaments]);

  if (user === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user === null) {
    return null; // Will redirect
  }

  return (
    <div className="flex-1 w-full bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-glow">
              <User className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                {user.displayName || "Player Profile"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                  <ShieldCheck className="h-3 w-3" /> Player
                </span>
              </div>
            </div>
          </div>
          
          <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>

        <Tabs defaultValue="tournaments" className="space-y-8">
          <TabsList className="bg-surface/50 border border-border p-1 rounded-xl h-auto flex flex-wrap max-w-fit">
            <TabsTrigger value="tournaments" className="rounded-lg px-6 py-2.5 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all">
              <Trophy className="mr-2 h-4 w-4" /> My Tournaments
            </TabsTrigger>
            <TabsTrigger value="matches" className="rounded-lg px-6 py-2.5 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all">
              <Calendar className="mr-2 h-4 w-4" /> Match History
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg px-6 py-2.5 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tournaments" className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Registered Events</h2>
            </div>
            
            {isLoadingTournaments ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : myTournaments.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myTournaments.map(t => (
                  <TournamentCard key={t.id} tournament={t} onClick={() => {}} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/20 p-12 text-center">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tournaments yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  You haven't registered for any tournaments. Check out the upcoming events and join the action!
                </p>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary-glow shadow-glow-sm">
                  <Link to="/home">Browse Tournaments</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches" className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Recent Matches</h2>
            </div>
            
            {isLoadingMatches ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : myMatches.length > 0 ? (
               <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold">Match</th>
                      <th className="px-6 py-4 text-center font-semibold">Score</th>
                      <th className="px-6 py-4 text-right font-semibold">Status</th>
                      <th className="px-6 py-4 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {myMatches.slice(0, 10).map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">{m.teamA} vs {m.teamB}</span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">{m.stage} {m.pool ? `· Pool ${m.pool}` : ""}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center tabular-nums font-black text-lg">
                          {m.status === "complete" ? (
                            <span className="text-foreground">{m.scoreA} - {m.scoreB}</span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            m.status === 'complete' ? 'border-success/30 bg-success/10 text-success' :
                            m.status === 'live' ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                            'border-border bg-muted text-muted-foreground'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <Button asChild size="sm" variant="ghost" className="h-8 group/btn">
                             <Link to="/match/$matchId" params={{ matchId: m.id }}>
                               View Details
                             </Link>
                           </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/20 p-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No match history</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your past and upcoming matches will appear here once you join a tournament.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 animate-fade-in max-w-2xl">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-6 border-b border-border/50">
                <h2 className="text-xl font-bold tracking-tight">Account Settings</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your profile details and preferences.</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email Address</Label>
                    <Input id="email" value={user.email || ""} disabled className="bg-surface border-border/50" />
                    <p className="text-[10px] text-muted-foreground">Your email is managed through your authentication provider.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-xs uppercase tracking-wider text-muted-foreground">Display Name</Label>
                    <Input id="displayName" defaultValue={user.displayName || ""} className="bg-surface border-border/50 focus-visible:ring-primary" />
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary-glow shadow-glow-sm">
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
