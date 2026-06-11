import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Volleyball, Loader2, LogIn, AlertCircle, Users, ArrowRight } from "lucide-react";
import { getMatchByJoinCode, joinMatch, getUserProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/join/$joinCode")({
  component: JoinMatchRoute,
  head: ({ params }) => ({
    meta: [
      { title: `Join Match ${params.joinCode} — Adelaide Grass Volleyball` }
    ]
  }),
});

function JoinMatchRoute() {
  const { joinCode } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userProfile, signInWithGoogle, loading: authLoading } = useAuth();
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");

  const { data: matchResult, isLoading, error, refetch } = useQuery({
    queryKey: ["matchByJoinCode", joinCode],
    queryFn: () => getMatchByJoinCode(joinCode),
    retry: false,
    refetchInterval: 3000, // Poll match state courtside
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("Please log in first");
      return joinMatch(joinCode, user.uid);
    },
    onSuccess: (data) => {
      toast.success(`Welcome to Team ${data.team}!`);
      queryClient.invalidateQueries({ queryKey: ["match", data.matchId] });
      navigate({ to: "/match/$matchId", params: { matchId: data.matchId } });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || "Failed to join the match");
    }
  });

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast.success("Signed in successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Google sign in failed.");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = manualCode.trim().toUpperCase();
    if (!cleanCode) return;
    if (!/^[A-HJ-NP-Z]{4}$/.test(cleanCode)) {
      setManualError("Code must be 4 capital letters (excluding I and O)");
      return;
    }
    setManualError("");
    navigate({ to: "/join/$joinCode", params: { joinCode: cleanCode } });
  };

  // 1. Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="absolute inset-0 grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Looking up join code {joinCode}...</p>
        </div>
      </div>
    );
  }

  // 2. Error or Invalid Code state
  if (error || !matchResult) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        
        <div className="relative w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-glow">
              <Volleyball className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-3 text-destructive mb-4">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <h2 className="text-lg font-semibold">Code Not Found</h2>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              The join code <span className="font-mono font-bold text-foreground">"{joinCode}"</span> was not found or is no longer active. Let's try typing it in manually:
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter 4-digit code (e.g. BVKR)"
                  maxLength={4}
                  className="bg-background border-border text-center text-xl font-bold tracking-widest uppercase font-mono h-12"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
                {manualError && <p className="text-xs text-destructive text-center">{manualError}</p>}
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
                Submit Join Code
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/home" className="text-primary hover:underline">Go to Dashboard</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { match, team } = matchResult;
  const teamName = team === "A" ? (match.teamA || "Team A") : (match.teamB || "Team B");
  const alreadyJoined = 
    match.playersA?.some(p => p.userId === user?.uid) || 
    match.playersB?.some(p => p.userId === user?.uid);

  const playersList = team === "A" ? (match.playersA || []) : (match.playersB || []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute inset-0 [background:var(--gradient-hero)]" />

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-glow">
            <Volleyball className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-6 border border-border shadow-glow">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">You're Joining</span>
          
          <div className="mt-2 flex flex-col gap-1">
            <h1 className="text-2xl font-black tracking-tight text-foreground">{match.label || "Casual Match"}</h1>
            <p className="text-sm text-muted-foreground">Point Target: {match.pointTarget || 21}</p>
          </div>

          <div className="my-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">ASSIGNED TEAM</p>
              <h3 className="text-xl font-bold text-foreground">{teamName}</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider ${
              team === "A" ? "bg-primary/20 text-primary border border-primary/30" : "bg-destructive/20 text-destructive border border-destructive/30"
            }`}>
              TEAM {team}
            </span>
          </div>

          {/* User Status Section */}
          {!user ? (
            // User is not logged in: Show login required
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Please log in with Google to register for this match.
              </p>
              <Button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground py-6 text-base rounded-xl"
              >
                <LogIn className="h-5 w-5" />
                Sign in with Google
              </Button>
            </div>
          ) : alreadyJoined ? (
            // User is already in the match: Show redirect button
            <div className="space-y-4">
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-center text-sm font-medium flex items-center justify-center gap-2">
                <Users className="h-4 w-4" />
                You've already joined this match!
              </div>
              <Button
                onClick={() => navigate({ to: "/match/$matchId", params: { matchId: match.id } })}
                className="w-full flex items-center justify-center gap-2 py-6 text-base rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
              >
                Go to Match Page
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            // User is logged in but hasn't joined: Show Join Match button
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Logged in as</p>
                <p className="font-semibold text-foreground">{userProfile?.displayName || user.email}</p>
              </div>

              <Button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-6 text-base rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
              >
                {joinMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Joining Match...
                  </>
                ) : (
                  <>
                    Join Team {team}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Roster list preview */}
          {playersList.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Already on {teamName}
              </h4>
              <ul className="space-y-2">
                {playersList.map((player) => (
                  <li key={player.userId} className="flex items-center gap-2 text-sm text-foreground/80">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    {player.displayName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
