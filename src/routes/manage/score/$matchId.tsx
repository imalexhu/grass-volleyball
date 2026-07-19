import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Undo2,
  Check,
  Trophy,
  History,
  Star,
  Radio,
  Zap,
  Loader2,
  Volleyball,
  QrCode,
  Copy,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { doc, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { subscribeToMatch, createRematch } from "@/lib/api";
import type { Match, MatchEvent, MatchPlayer } from "@/lib/types";
import { CourtView } from "@/components/CourtView";
import { useWhistle } from "@/hooks/useWhistle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rotateClockwise } from "@/lib/match-logic";

export const Route = createFileRoute("/manage/score/$matchId")({
  component: ScorePad,
  head: () => ({ meta: [{ title: "Scoring — Adelaide Grass Volleyball" }] }),
});

function ScorePad() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const whistle = useWhistle();

  const [match, setMatch] = useState<Match | null>(null);
  const [checklist, setChecklist] = useState({ recording: false, ready: false });
  const [showQRModal, setShowQRModal] = useState<"A" | "B" | null>(null);
  const [highlightMode, setHighlightMode] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winnerTeam, setWinnerTeam] = useState<"A" | "B" | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [rematching, setRematching] = useState(false);

  // Subscribe to match changes
  useEffect(() => {
    return subscribeToMatch(matchId, (updatedMatch) => {
      setMatch(updatedMatch);
    });
  }, [matchId]);

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading match data...</p>
        </div>
      </div>
    );
  }

  // If match status is not active (i.e. already complete, action required or processed),
  // show completion page.
  if (match.status !== "active") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-card border p-8 rounded-3xl shadow-xl">
          <div className="h-16 w-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
            <Trophy className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black">Scoring Completed</h2>
          <p className="text-muted-foreground leading-relaxed">
            This match is no longer in active scoring mode.
            <br />
            Status: <span className="font-bold text-foreground uppercase">{match.status}</span>
          </p>
          <div className="bg-muted/40 p-4 rounded-xl font-mono text-lg">
            Final Score: {match.scoreA ?? 0} - {match.scoreB ?? 0}
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-sm rounded-xl gap-2 flex items-center justify-center"
              onClick={handleTriggerRematch}
              disabled={rematching}
            >
              {rematching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> CREATING REMATCH...
                </>
              ) : (
                "QUICK REMATCH"
              )}
            </Button>
            <Button asChild variant="outline" className="w-full h-12 rounded-xl">
              <Link to="/manage">Return to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const events = match.events || [];
  const activeRosterA = match.activeRosterA || [];
  const activeRosterB = match.activeRosterB || [];
  const playersA = match.playersA || [];
  const playersB = match.playersB || [];

  // Derive score and rally state
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;
  const currentServingTeam = match.servingTeam ?? "A";
  const rallyInProgress = lastEvent ? lastEvent.type === "serve" : false;

  const highlightsCount = events.filter((e) => e.isHighlight).length;

  // ----------------------------------------------------
  // Screen 1: Pre-Match Setup Actions
  // ----------------------------------------------------
  const handleSetRosterSize = async (size: number) => {
    const matchRef = doc(db, "matches", match.id);
    const newRosterA = activeRosterA.slice(0, size);
    const newRosterB = activeRosterB.slice(0, size);
    await updateDoc(matchRef, {
      rosterSize: size,
      activeRosterA: newRosterA,
      activeRosterB: newRosterB
    });
    toast.success(`Match format set to ${size}v${size}`);
  };

  const handleTogglePlayerActive = async (team: "A" | "B", userId: string) => {
    const currentRoster = team === "A" ? [...activeRosterA] : [...activeRosterB];
    const index = currentRoster.indexOf(userId);
    const targetSize = match.rosterSize || 4;

    if (index > -1) {
      // Deactivate
      currentRoster.splice(index, 1);
    } else {
      // Activate (limit to targetSize)
      if (currentRoster.length >= targetSize) {
        toast.warning(`Only ${targetSize} players can be active at a time.`);
        return;
      }
      currentRoster.push(userId);
    }

    const matchRef = doc(db, "matches", match.id);
    if (team === "A") {
      await updateDoc(matchRef, { activeRosterA: currentRoster });
    } else {
      await updateDoc(matchRef, { activeRosterB: currentRoster });
    }
  };

  const handleReorderRoster = async (team: "A" | "B", newPositions: string[]) => {
    const matchRef = doc(db, "matches", match.id);
    if (team === "A") {
      await updateDoc(matchRef, { activeRosterA: newPositions });
    } else {
      await updateDoc(matchRef, { activeRosterB: newPositions });
    }
  };

  const handleStartMatch = async () => {
    const targetSize = match.rosterSize || 4;
    if (activeRosterA.length !== targetSize || activeRosterB.length !== targetSize) {
      toast.error(`Rosters must have exactly ${targetSize} active players each.`);
      return;
    }
    if (!checklist.recording || !checklist.ready) {
      toast.error("Please confirm all setup checklist items.");
      return;
    }

    whistle.play();
    const matchRef = doc(db, "matches", match.id);
    await updateDoc(matchRef, {
      phase: "live",
      scoreA: 0,
      scoreB: 0,
      servingTeam: "A",
      events: [],
    });
    toast.success("Match has started! Blow that whistle!");
  };

  // ----------------------------------------------------
  // Screen 2: Live Scoring Actions
  // ----------------------------------------------------
  const handleStartServe = async () => {
    whistle.play();

    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substring(2, 11),
      type: "serve",
      timestamp: Date.now(),
      scoreA,
      scoreB,
      servingTeam: currentServingTeam,
      rosterA: activeRosterA,
      rosterB: activeRosterB,
    };

    const matchRef = doc(db, "matches", match.id);
    await updateDoc(matchRef, {
      events: [...events, newEvent],
    });
  };

  const handlePointScored = async (scoringTeam: "A" | "B") => {
    whistle.play();

    const nextScoreA = scoringTeam === "A" ? scoreA + 1 : scoreA;
    const nextScoreB = scoringTeam === "B" ? scoreB + 1 : scoreB;
    const sideOut = currentServingTeam !== scoringTeam;

    let nextRosterA = [...activeRosterA];
    let nextRosterB = [...activeRosterB];

    if (sideOut) {
      if (scoringTeam === "A") {
        nextRosterA = rotateClockwise(nextRosterA);
      } else {
        nextRosterB = rotateClockwise(nextRosterB);
      }
    }

    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substring(2, 11),
      type: "point",
      team: scoringTeam,
      timestamp: Date.now(),
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      servingTeam: scoringTeam,
      rosterA: nextRosterA,
      rosterB: nextRosterB,
    };

    const matchRef = doc(db, "matches", match.id);
    await updateDoc(matchRef, {
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      servingTeam: scoringTeam,
      activeRosterA: nextRosterA,
      activeRosterB: nextRosterB,
      events: [...events, newEvent],
    });

    // Check for match completion
    const pointTarget = match.pointTarget ?? 21;
    if (nextScoreA >= pointTarget && nextScoreA - nextScoreB >= 2) {
      setWinnerTeam("A");
      setShowWinModal(true);
    } else if (nextScoreB >= pointTarget && nextScoreB - nextScoreA >= 2) {
      setWinnerTeam("B");
      setShowWinModal(true);
    }
  };

  const handleMarkHighlight = async (playerId?: string, playerName?: string) => {
    if (events.length === 0) return;

    // Find the last point event index
    const reversedEvents = [...events].reverse();
    const lastPointIdx = events.length - 1 - reversedEvents.findIndex((e) => e.type === "point");

    if (lastPointIdx < 0 || lastPointIdx >= events.length) {
      toast.error("No point events found to highlight.");
      return;
    }

    const updatedEvents = [...events];
    updatedEvents[lastPointIdx] = {
      ...updatedEvents[lastPointIdx],
      isHighlight: true,
      highlightPlayerId: playerId,
      highlightPlayerName: playerName,
    };

    const matchRef = doc(db, "matches", match.id);
    await updateDoc(matchRef, {
      events: updatedEvents,
    });

    setShowHighlightSelector(false);
    toast.success(playerName ? `Highlight marked for ${playerName}! ⭐` : "Match highlight marked! ⭐");
  };

  const handleUndo = async () => {
    if (events.length === 0) return;

    const nextEvents = events.slice(0, -1);
    const matchRef = doc(db, "matches", match.id);

    if (nextEvents.length === 0) {
      // Reset to setup state or initial live state
      await updateDoc(matchRef, {
        scoreA: 0,
        scoreB: 0,
        servingTeam: "A",
        events: [],
      });
      toast.info("First event undone.");
      return;
    }

    // Find new score and serving states from remaining events
    const lastPointEvent = [...nextEvents].reverse().find((e) => e.type === "point");
    const newScoreA = lastPointEvent ? lastPointEvent.scoreA : 0;
    const newScoreB = lastPointEvent ? lastPointEvent.scoreB : 0;

    const lastOverallEvent = nextEvents[nextEvents.length - 1];
    const newServingTeam = lastOverallEvent.servingTeam ?? "A";

    // Restore rosters to what they were during that last event
    const newRosterA = lastOverallEvent.rosterA ?? activeRosterA;
    const newRosterB = lastOverallEvent.rosterB ?? activeRosterB;

    await updateDoc(matchRef, {
      scoreA: newScoreA,
      scoreB: newScoreB,
      servingTeam: newServingTeam,
      activeRosterA: newRosterA,
      activeRosterB: newRosterB,
      events: nextEvents,
    });

    toast.info("Last action undone.");
  };

  const handleFinalizeMatch = async () => {
    setFinalizing(true);
    try {
      const matchRef = doc(db, "matches", match.id);
      await updateDoc(matchRef, {
        phase: "complete",
        status: "action_required",
        completedAt: Date.now(),
      });
      toast.success("Match finalized!");
      navigate({ to: "/manage" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to finalize match.");
    } finally {
      setFinalizing(false);
      setShowWinModal(false);
    }
  };

  const handleTriggerRematch = async () => {
    setRematching(true);
    try {
      if (match.status === "active") {
        const matchRef = doc(db, "matches", match.id);
        await updateDoc(matchRef, {
          phase: "complete",
          status: "action_required",
          completedAt: Date.now(),
        });
      }

      const newMatchId = await createRematch(match);
      toast.success("Rematch created! Ready to play.");
      setShowWinModal(false);
      navigate({ to: "/manage/score/$matchId", params: { matchId: newMatchId } });
    } catch (err) {
      console.error("Failed to trigger rematch:", err);
      toast.error("Failed to start rematch.");
    } finally {
      setRematching(false);
    }
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    toast.success(`Copied join link for Team ${code === match.joinCodeA ? "A" : "B"}!`);
  };

  // ----------------------------------------------------
  // Screen Rendering
  // ----------------------------------------------------
  const renderSetupScreen = () => {
    const targetSize = match.rosterSize || 4;
    const readyToStart =
      activeRosterA.length === targetSize &&
      activeRosterB.length === targetSize &&
      checklist.recording &&
      checklist.ready;

    return (
      <div className="flex-1 flex flex-col gap-6 p-4">
        {/* Title */}
        <div className="text-center space-y-1 py-2">
          <h2 className="text-xl font-bold tracking-tight">{match.label || "Casual Match"}</h2>
          <p className="text-xs text-muted-foreground">Pre-Match Setup & Player Registration</p>
        </div>

        {/* Match Format Selection */}
        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Match Format</span>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              {targetSize}v{targetSize}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((size) => (
              <Button
                key={size}
                type="button"
                className={`h-10 rounded-xl font-bold transition-all ${
                  targetSize === size
                    ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
                    : "bg-background border border-border text-foreground hover:bg-muted"
                }`}
                onClick={() => handleSetRosterSize(size)}
              >
                {size}v{size}
              </Button>
            ))}
          </div>
        </div>

        {/* Join Codes Card */}
        <div className="bg-card border rounded-2xl p-4 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center p-3 rounded-xl border bg-primary/5 border-primary/10">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Team A Code</span>
            <span className="text-2xl font-black font-mono tracking-wider mb-3">{match.joinCodeA}</span>
            <div className="flex gap-1.5 w-full">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 h-8 text-[11px] rounded-lg"
                onClick={() => setShowQRModal("A")}
              >
                <QrCode className="h-3 w-3 mr-1" /> QR Code
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={() => match.joinCodeA && handleCopyLink(match.joinCodeA)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center p-3 rounded-xl border bg-destructive/5 border-destructive/10">
            <span className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">Team B Code</span>
            <span className="text-2xl font-black font-mono tracking-wider mb-3">{match.joinCodeB}</span>
            <div className="flex gap-1.5 w-full">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 h-8 text-[11px] rounded-lg"
                onClick={() => setShowQRModal("B")}
              >
                <QrCode className="h-3 w-3 mr-1" /> QR Code
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={() => match.joinCodeB && handleCopyLink(match.joinCodeB)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Team Rosters Selection */}
        <div className="grid grid-cols-2 gap-4">
          {/* Team A Roster Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team A</h3>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {activeRosterA.length}/{targetSize} Active
              </span>
            </div>
            <div className="bg-card border rounded-2xl p-2 min-h-[140px] space-y-1">
              {playersA.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground italic">
                  Awaiting players to scan QR...
                </div>
              ) : (
                playersA.map((p) => {
                  const isActive = activeRosterA.includes(p.userId);
                  return (
                    <button
                      key={p.userId}
                      onClick={() => handleTogglePlayerActive("A", p.userId)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-muted/40 hover:bg-muted/70 text-foreground"
                      }`}
                    >
                      <span className="truncate">{p.displayName}</span>
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Team B Roster Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team B</h3>
              <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                {activeRosterB.length}/{targetSize} Active
              </span>
            </div>
            <div className="bg-card border rounded-2xl p-2 min-h-[140px] space-y-1">
              {playersB.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground italic">
                  Awaiting players to scan QR...
                </div>
              ) : (
                playersB.map((p) => {
                  const isActive = activeRosterB.includes(p.userId);
                  return (
                    <button
                      key={p.userId}
                      onClick={() => handleTogglePlayerActive("B", p.userId)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-destructive text-destructive-foreground shadow"
                          : "bg-muted/40 hover:bg-muted/70 text-foreground"
                      }`}
                    >
                      <span className="truncate">{p.displayName}</span>
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Court Preview */}
        {activeRosterA.length > 0 || activeRosterB.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Roster Court Positions</h3>
              <span className="text-[10px] text-muted-foreground italic">Drag cards to reorder</span>
            </div>
            <CourtView
              teamA={{
                name: match.teamA || "Team A",
                players: playersA,
                positions: activeRosterA,
              }}
              teamB={{
                name: match.teamB || "Team B",
                players: playersB,
                positions: activeRosterB,
              }}
              interactive={true}
              onReorder={handleReorderRoster}
            />
          </div>
        ) : null}

        {/* Checklist */}
        <div className="space-y-3 pt-2">
          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              checklist.recording ? "bg-primary/5 border-primary/20" : "bg-card border-border"
            }`}
            onClick={() => setChecklist((c) => ({ ...c, recording: !c.recording }))}
          >
            <Checkbox
              checked={checklist.recording}
              onCheckedChange={(v) => setChecklist((c) => ({ ...c, recording: !!v }))}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="space-y-0.5">
              <div className="text-xs font-bold">Camera is Recording</div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Confirm a phone/camera is set up and recording the court.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              checklist.ready ? "bg-primary/5 border-primary/20" : "bg-card border-border"
            }`}
            onClick={() => setChecklist((c) => ({ ...c, ready: !c.ready }))}
          >
            <Checkbox
              checked={checklist.ready}
              onCheckedChange={(v) => setChecklist((c) => ({ ...c, ready: !!v }))}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="space-y-0.5">
              <div className="text-xs font-bold">Rosters are Ready</div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                {targetSize} players are selected on both courts and ready to start.
              </p>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStartMatch}
          disabled={!readyToStart}
          className="w-full h-14 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-black text-sm rounded-xl shadow-glow transition-all active:scale-[0.99] disabled:opacity-55"
        >
          START MATCH & GO LIVE
        </Button>
      </div>
    );
  };

  const renderLiveScreen = () => {
    return (
      <div className="flex-1 flex flex-col gap-5 p-4">
        {/* Score Board */}
        <div className="grid grid-cols-2 bg-card border rounded-2xl overflow-hidden shadow-md relative">
          {/* Divider */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="h-9 w-9 rounded-full bg-background border flex items-center justify-center text-[10px] font-black text-muted-foreground shadow-md">
              VS
            </div>
          </div>

          {/* Team A */}
          <div className="p-5 text-center relative">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate mb-2">
              {match.teamA || "Team A"}
            </div>
            <div className="text-6xl font-black font-mono text-primary select-none drop-shadow-sm">
              {scoreA}
            </div>
          </div>

          {/* Team B */}
          <div className="p-5 text-center border-l relative">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate mb-2">
              {match.teamB || "Team B"}
            </div>
            <div className="text-6xl font-black font-mono text-destructive select-none drop-shadow-sm">
              {scoreB}
            </div>
          </div>
        </div>

        {/* Court View */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Court Layout & Serve
            </span>
            {rallyInProgress && !highlightMode && (
              <span className="text-[10px] font-bold text-amber-500 animate-pulse uppercase flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block animate-ping" />
                Rally Active
              </span>
            )}
            {highlightMode && (
              <span className="text-[10px] font-bold text-yellow-500 animate-pulse uppercase flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 inline-block animate-ping" />
                Highlight Selector Active
              </span>
            )}
          </div>

          {highlightMode && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 p-3.5 rounded-xl text-center text-xs font-semibold animate-fade-in flex flex-col gap-2 shadow-sm">
              <div>Tap a player card on the court below to attribute the highlight to them.</div>
              <div className="flex gap-2 justify-center mt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-[11px] font-bold bg-yellow-500 hover:bg-yellow-600 text-black border-none"
                  onClick={() => {
                    handleMarkHighlight();
                    setHighlightMode(false);
                  }}
                >
                  General Match Highlight
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] font-bold"
                  onClick={() => setHighlightMode(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <CourtView
            teamA={{
              name: match.teamA || "Team A",
              players: playersA,
              positions: activeRosterA,
            }}
            teamB={{
              name: match.teamB || "Team B",
              players: playersB,
              positions: activeRosterB,
            }}
            servingTeam={currentServingTeam}
            interactive={true}
            onReorder={handleReorderRoster}
            highlightMode={highlightMode}
            onPlayerClick={async (team, playerId, displayName) => {
              await handleMarkHighlight(playerId, displayName);
              setHighlightMode(false);
            }}
          />
        </div>

        {/* Scoring Rallies Controls */}
        <div className="space-y-3 py-1">
          {!rallyInProgress ? (
            <Button
              onClick={handleStartServe}
              className="w-full h-16 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm rounded-xl shadow-lg border border-amber-400/20 gap-2 flex items-center justify-center animate-pulse"
            >
              <Radio className="h-4 w-4" /> START SERVE (BLOW WHISTLE)
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3 h-16">
              <Button
                onClick={() => handlePointScored("A")}
                className="h-full bg-gradient-to-br from-primary to-primary-glow hover:opacity-95 text-primary-foreground font-black text-sm rounded-xl shadow-md gap-1"
              >
                <Zap className="h-4 w-4" /> Team A Point
              </Button>
              <Button
                onClick={() => handlePointScored("B")}
                className="h-full bg-gradient-to-br from-destructive to-destructive/90 hover:opacity-95 text-destructive-foreground font-black text-sm rounded-xl shadow-md gap-1"
              >
                <Zap className="h-4 w-4" /> Team B Point
              </Button>
            </div>
          )}
        </div>

        {/* Roster & Stats Helpers */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setHighlightMode(!highlightMode)}
            variant={highlightMode ? "default" : "outline"}
            disabled={events.length === 0}
            className={cn(
              "h-12 rounded-xl text-xs font-bold gap-2 transition-all",
              highlightMode
                ? "bg-yellow-500 hover:bg-yellow-600 text-black shadow-[0_0_15px_rgba(250,204,21,0.5)] border-yellow-400"
                : "bg-yellow-500/5 hover:bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
            )}
          >
            <Star className="h-4 w-4 fill-current" />
            Highlight ({highlightsCount})
          </Button>

          <Button
            onClick={handleUndo}
            variant="outline"
            disabled={events.length === 0}
            className="h-12 rounded-xl text-xs font-bold gap-2"
          >
            <Undo2 className="h-4 w-4" /> Undo Last
          </Button>
        </div>

        {/* Recent Events Log */}
        <div className="space-y-2 pt-2 border-t flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Recent Events
            </span>
            <span className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {events.length} Logs
            </span>
          </div>

          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic border border-dashed rounded-xl">
                No scoring events yet. Start serve to begin!
              </div>
            ) : (
              [...events]
                .reverse()
                .slice(0, 5)
                .map((e) => {
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-xs bg-card border px-3 py-2 rounded-xl shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(e.timestamp).toLocaleTimeString([], {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span className="font-semibold capitalize text-[11px]">
                          {e.type} {e.team && `· Team ${e.team}`}
                          {e.isHighlight && (
                            <span className="inline-flex items-center ml-1 text-yellow-500">
                              <Star className="h-3 w-3 fill-current inline" />
                              {e.highlightPlayerName && ` (${e.highlightPlayerName})`}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="font-bold font-mono">
                        {e.scoreA} - {e.scoreB}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link
            to="/manage"
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Live Scoring
            </span>
            <span className="text-xs font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full mt-0.5">
              Goal: {match.pointTarget ?? 21} Points
            </span>
          </div>
          <div className="w-16 flex justify-end">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Renders */}
      <main className="flex-1 flex flex-col max-w-md w-full mx-auto pb-8">
        {match.phase === "live" ? renderLiveScreen() : renderSetupScreen()}
      </main>

      {/* QR Code Modals */}
      <Dialog open={showQRModal !== null} onOpenChange={() => setShowQRModal(null)}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Team {showQRModal} Registration</DialogTitle>
            <DialogDescription>
              Scan this QR code with a phone camera to join Team {showQRModal}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border shadow-sm my-2">
            {showQRModal && (
              <QRCodeSVG
                value={`${window.location.origin}/join/${
                  showQRModal === "A" ? match.joinCodeA : match.joinCodeB
                }`}
                size={180}
                level="M"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setShowQRModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Match Win Overlay Dialog */}
      <Dialog open={showWinModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-[340px] rounded-2xl [&>button]:hidden">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-black flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Match Completed!
            </DialogTitle>
            <DialogDescription className="text-center py-2">
              Winner:{" "}
              <span className="font-extrabold text-foreground underline decoration-primary decoration-2">
                {winnerTeam === "A" ? match.teamA || "Team A" : match.teamB || "Team B"}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-muted/40 rounded-xl text-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
              Final Score
            </span>
            <span className="text-3xl font-black font-mono">
              {scoreA} - {scoreB}
            </span>
          </div>

          <DialogFooter className="flex-col gap-2 mt-2">
            <Button
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm rounded-xl gap-2 flex items-center justify-center"
              onClick={handleTriggerRematch}
              disabled={rematching || finalizing}
            >
              {rematching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> CREATING REMATCH...
                </>
              ) : (
                "QUICK REMATCH"
              )}
            </Button>
            <Button
              variant="secondary"
              className="w-full h-12 font-bold text-sm rounded-xl gap-2"
              onClick={handleFinalizeMatch}
              disabled={finalizing || rematching}
            >
              {finalizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> FINALIZING...
                </>
              ) : (
                "FINALIZE MATCH"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={() => setShowWinModal(false)}
              disabled={finalizing || rematching}
            >
              Back to Score Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
