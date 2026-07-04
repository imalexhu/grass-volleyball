import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Trophy,
  Calendar,
  Settings,
  ShieldCheck,
  LogOut,
  Loader2,
  Star,
  Activity,
  Check,
  Zap,
  TrendingUp,
  Award,
  Video
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { getTournaments, getMatches, subscribeToNotifications, markNotificationRead } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { TournamentCard } from "@/components/TournamentCard";
import type { UserNotification } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (user === null) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  // Subscribe to user notifications
  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });
  }, [user]);

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
    return tournaments.filter((t) =>
      t.registeredTeams?.some(
        (team) =>
          team.captain === user.displayName ||
          team.captain === user.email ||
          (user.displayName && team.name.toLowerCase().includes(user.displayName.toLowerCase()))
      )
    );
  }, [tournaments, user]);

  const myMatches = useMemo(() => {
    if (!user) return [];
    return allMatches.filter(
      (m) =>
        m.playersA?.some((p) => p.userId === user.uid) ||
        m.playersB?.some((p) => p.userId === user.uid) ||
        m.activeRosterA?.includes(user.uid) ||
        m.activeRosterB?.includes(user.uid)
    );
  }, [allMatches, user]);

  // Dynamic career stats computation
  const stats = useMemo(() => {
    if (!user || myMatches.length === 0) {
      return {
        played: 0,
        won: 0,
        lost: 0,
        winRate: 0,
        pointsPlayed: 0,
        highlightsReceived: 0,
        highlightRate: 0,
      };
    }

    let won = 0;
    let pointsPlayed = 0;
    let highlightsReceived = 0;

    myMatches.forEach((m) => {
      const isTeamA =
        m.playersA?.some((p) => p.userId === user.uid) || m.activeRosterA?.includes(user.uid);
      const isTeamB =
        m.playersB?.some((p) => p.userId === user.uid) || m.activeRosterB?.includes(user.uid);

      const scoreA = m.scoreA ?? 0;
      const scoreB = m.scoreB ?? 0;

      if (isTeamA) {
        if (scoreA > scoreB) won++;
      } else if (isTeamB) {
        if (scoreB > scoreA) won++;
      }

      // Process match events for points played & highlight attributions
      const events = m.events || [];
      events.forEach((event) => {
        if (event.type === "point") {
          const activeRoster = isTeamA
            ? event.rosterA || []
            : event.rosterB || [];

          if (activeRoster.includes(user.uid)) {
            pointsPlayed++;
          }

          if (event.isHighlight && event.highlightPlayerId === user.uid) {
            highlightsReceived++;
          }
        }
      });
    });

    const played = myMatches.length;
    const lost = played - won;
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
    const highlightRate = pointsPlayed > 0 ? Math.round((highlightsReceived / pointsPlayed) * 100) : 0;

    return {
      played,
      won,
      lost,
      winRate,
      pointsPlayed,
      highlightsReceived,
      highlightRate,
    };
  }, [myMatches, user]);

  const handleNotificationClick = async (notif: UserNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
    }
  };

  if (user === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user === null) {
    return null; // Redirecting...
  }

  return (
    <div className="flex-1 w-full bg-background min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        {/* Profile Title Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-glow shrink-0">
              <User className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {user.displayName || "Player Profile"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono">{user.email}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                  <ShieldCheck className="h-3 w-3" /> {userProfile?.role || "Player"}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:text-foreground h-10 rounded-xl"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>

        {/* Dynamic Career Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={TrendingUp} />
          <StatCard label="Record" value={`${stats.won}-${stats.lost}`} icon={Trophy} />
          <StatCard label="Highlight Rate" value={`${stats.highlightRate}%`} icon={Star} />
          <StatCard label="Points Played" value={stats.pointsPlayed} icon={Zap} />
          <StatCard label="Highlights" value={stats.highlightsReceived} icon={Award} />
          <StatCard label="Matches" value={stats.played} icon={Calendar} />
        </div>

        {/* Dynamic Tab Panels */}
        <Tabs defaultValue="matches" className="space-y-8">
          <TabsList className="bg-muted/50 border border-white/5 p-1 rounded-xl h-auto flex flex-wrap max-w-fit">
            <TabsTrigger
              value="matches"
              className="rounded-lg px-5 py-2 text-xs font-bold transition-all"
            >
              <Calendar className="mr-2 h-3.5 w-3.5" /> Recent Matches
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-lg px-5 py-2 text-xs font-bold transition-all relative"
            >
              <Activity className="mr-2 h-3.5 w-3.5" /> Activity Feed
              {notifications.some((n) => !n.read) && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="tournaments"
              className="rounded-lg px-5 py-2 text-xs font-bold transition-all"
            >
              <Trophy className="mr-2 h-3.5 w-3.5" /> Tournaments
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg px-5 py-2 text-xs font-bold transition-all"
            >
              <Settings className="mr-2 h-3.5 w-3.5" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* 1. MATCH HISTORY TAB */}
          <TabsContent value="matches" className="space-y-6">
            {isLoadingMatches ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myMatches.length > 0 ? (
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left">Match</th>
                      <th className="px-5 py-3 text-center">Score</th>
                      <th className="px-5 py-3 text-right">Status</th>
                      <th className="px-5 py-3 text-right">VODs</th>
                      <th className="px-5 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t">
                    {myMatches.slice(0, 10).map((m) => (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {m.label || `${m.teamA} vs ${m.teamB}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                              {m.stage || "casual"} {m.pool ? `· Pool ${m.pool}` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold font-mono text-base tabular-nums">
                          {m.scoreA} - {m.scoreB}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-0.5 text-[9px] uppercase font-bold tracking-wider",
                              m.status === "processed" || m.status === "complete"
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-warning/30 bg-warning/10 text-warning"
                            )}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            {m.vodUrl && (
                              <a
                                href={m.vodUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded text-red-500 bg-red-500/10 hover:bg-red-500/20"
                                title="Trimmed VOD"
                              >
                                <Video className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {m.matchHighlightsUrl && (
                              <a
                                href={m.matchHighlightsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
                                title="Highlights"
                              >
                                <Star className="h-3.5 w-3.5 fill-current" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button asChild size="sm" variant="ghost" className="h-8 text-xs rounded-lg">
                            <Link to="/match/$matchId" params={{ matchId: m.id }}>
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-card/20 p-12 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold mb-1">No match history</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Your past and upcoming matches will appear here once you join via code.
                </p>
              </div>
            )}
          </TabsContent>

          {/* 2. ACTIVITY / NOTIFICATIONS FEED TAB */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Activity Feed</h3>
              {notifications.some((n) => !n.read) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const unread = notifications.filter((n) => !n.read);
                    for (const n of unread) {
                      await markNotificationRead(n.id);
                    }
                  }}
                  className="h-8 text-xs text-primary font-bold"
                >
                  Mark all as read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/20 p-12 text-center text-xs text-muted-foreground italic">
                No recent activity. All notifications are up to date!
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    to="/match/$matchId"
                    params={{ matchId: n.matchId }}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "block border p-4 rounded-2xl shadow-sm transition-all hover:bg-muted/15 relative overflow-hidden",
                      n.read ? "bg-card/40 border-border/40" : "bg-primary/5 border-primary/20"
                    )}
                  >
                    {!n.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold">{n.title}</h4>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 3. TOURNAMENTS TAB */}
          <TabsContent value="tournaments" className="space-y-6">
            {isLoadingTournaments ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myTournaments.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myTournaments.map((t) => (
                  <TournamentCard key={t.id} tournament={t} onClick={() => {}} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-card/20 p-12 text-center">
                <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold mb-1">No registered tournaments</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Browse tournaments on Adelaide Grass Volleyball to join!
                </p>
              </div>
            )}
          </TabsContent>

          {/* 4. SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-6 max-w-2xl">
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-base font-bold">Account Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your player profile details.</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      value={user.email || ""}
                      disabled
                      className="bg-muted/40 border-border/50 text-xs h-10 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Display Name
                    </Label>
                    <Input
                      id="displayName"
                      defaultValue={user.displayName || ""}
                      className="bg-surface border-border/50 focus-visible:ring-primary text-xs h-10"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary-glow font-bold text-xs h-10 rounded-xl px-5">
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

// Stats Card helper component
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card border rounded-2xl p-4 shadow-sm relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
      <div className="mt-2 text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}
