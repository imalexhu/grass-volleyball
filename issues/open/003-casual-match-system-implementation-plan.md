# Casual Match System — Implementation Plan

Build the core match loop for Sunday's test match: create → join → score → process → view.

## Existing Infrastructure (Reused As-Is)

| Layer | Status |
|-------|--------|
| **Google OAuth** | ✅ [AuthContext.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/contexts/AuthContext.tsx) — `signInWithGoogle` via Firebase popup |
| **Firebase Auth + Firestore + Storage** | ✅ [firebase.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/lib/firebase.ts) |
| **YouTube upload** | ✅ [youtube.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/server/youtube.ts) |
| **Cloud Run video worker** | ✅ [worker.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/cloud-run/src/worker.ts) |
| **shadcn/ui (46 components)** | ✅ Already installed |
| **Vercel deployment** | ✅ Configured |

---

## User Review Required

> [!IMPORTANT]
> **Tournament system breakage**: The existing tournament bracket/fixture system will be broken by this work. We will open a GitHub issue documenting what broke and what needs to be restored later. The casual match system is the priority — tournaments are a future concern.

> [!WARNING]
> **Scoring page full rewrite**: The current [score page](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/score/%24matchId.tsx) will be completely rewritten for the new court quadrant view, auto-rotation, whistle sounds, and player-level highlight attribution.

> [!IMPORTANT]
> **Three match statuses**: Matches flow through `ACTIVE` → `ACTION_REQUIRED` → `PROCESSED`. This replaces the current `scheduled | live | complete` status model.

---

## Resolved Design Decisions

| Decision | Answer |
|----------|--------|
| **Join code format** | 4 capital letters, Kahoot/Jackbox style (e.g., `BVKR`) |
| **Win by 2** | Yes, always win by 2 |
| **Video start offset** | Admin inputs start time alongside video drop, presses Submit to trigger processing |
| **Highlight perspective** | Match highlights alternate by scoring team. If 1 camera/perspective, fallback to that single perspective. |
| **Video count** | Exactly 2 videos per match: 1 trimmed match video (winning team's perspective or fallback) and 1 match highlight reel. |
| **Player shuffling** | Each game is a separate match entity; players rejoin via new codes |
| **Whistle sound** | Will source a royalty-free whistle MP3; user can provide their own if preferred |

---

## Data Model

### Match Statuses (New)

```
ACTIVE          → Match is live or pre-match (players joining, scoring in progress)
ACTION_REQUIRED → Match scoring is complete, awaiting video upload & processing
PROCESSED       → All videos uploaded, trimmed, highlights created — match is fully done
```

### Firestore: `matches` Collection (Revised)

```typescript
interface Match {
  id: string;
  label: string;                  // e.g., "Game 1 — Sunday Session"
  createdBy: string;              // Admin user ID

  // ── Join Codes ──
  joinCodeA: string;              // 4 capital letters for Team A (e.g., "BVKR")
  joinCodeB: string;              // 4 capital letters for Team B (e.g., "MXPL")

  // ── Players ──
  playersA: MatchPlayer[];        // All players who joined Team A
  playersB: MatchPlayer[];        // All players who joined Team B
  activeRosterA: string[];        // 4 userIds in position order [pos1, pos2, pos3, pos4]
  activeRosterB: string[];        // 4 userIds in position order [pos1, pos2, pos3, pos4]

  // ── Scoring Config ──
  pointTarget: number;            // First to N (default 21)
  // Win by 2 is always enforced

  // ── Live State ──
  status: "active" | "action_required" | "processed";
  phase: "setup" | "live" | "complete"; // Sub-state within "active"
  servingTeam: "A" | "B";
  scoreA: number;
  scoreB: number;
  events: MatchEvent[];

  // ── Video ──
  rawStoragePathA?: string;       // Firebase Storage path for Camera A
  rawStoragePathB?: string;       // Firebase Storage path for Camera B
  videoOffsetA?: number;          // Seconds into raw video where first serve happens
  videoOffsetB?: number;
  vodUrl?: string;                // YouTube URL for trimmed match video (winning team perspective, or fallback)
  matchHighlightsUrl?: string;    // YouTube URL for combined highlight reel
  processingJobA?: VideoProcessingJob;
  processingJobB?: VideoProcessingJob;
  processingJobHighlights?: VideoProcessingJob;

  // ── Metadata ──
  createdAt: number;
  completedAt?: number;
}

interface MatchPlayer {
  userId: string;
  displayName: string;
  photoURL?: string;
  joinedAt: number;
}

interface MatchEvent {
  id: string;
  type: "serve" | "point";
  team?: "A" | "B";              // Which team scored (only on "point")
  timestamp: number;             // Date.now() — used for video sync
  scoreA: number;
  scoreB: number;
  servingTeam: "A" | "B";       // Who served this rally
  isHighlight?: boolean;
  highlightPlayerId?: string;    // Attributed player (or undefined for match highlight)
  highlightPlayerName?: string;
  rosterA?: string[];            // Position snapshot at this event
  rosterB?: string[];
}
```

### Firestore: `notifications` Collection (New)

```typescript
interface UserNotification {
  id: string;
  userId: string;
  type: "match_complete" | "video_processed" | "highlight_received";
  matchId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}
```

### Firestore: `users` Collection (Extended)

Add optional computed stats fields to `UserProfile`:

```typescript
// Added to UserProfile
matchesPlayed?: number;
matchesWon?: number;
highlightsReceived?: number;
pointsPlayed?: number;
```

---

## Proposed Changes

### Phase 1 — Data Model & API Layer

#### [MODIFY] [types.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/lib/types.ts)
- Replace `Match` interface with new schema (join codes, players, rosters, phases)
- Add `MatchPlayer`, `UserNotification` interfaces
- Update `MatchEvent` with `servingTeam`, `highlightPlayerId`, `rosterA/B`
- Update `VideoProcessingJob` with `videoOffset` field
- Extend `UserProfile` with optional stats fields

#### [MODIFY] [api.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/lib/api.ts)
- Strip out tournament-specific functions (fixtures, standings, team registration) — keep the core CRUD
- Add new functions:

| Function | Purpose |
|----------|---------|
| `generateJoinCode()` | Generate unique 4-letter uppercase code, check for collisions |
| `createCasualMatch(adminId, config)` | Create match with two join codes |
| `getMatchByJoinCode(code)` | Look up match by either join code |
| `joinMatch(joinCode, userId)` | Add player to correct team, return `{matchId, team}` |
| `setActiveRoster(matchId, team, userIds[4])` | Set 4 active players in position order |
| `rotateTeam(matchId, team)` | Clockwise: `[1,2,3,4]` → `[2,3,4,1]` |
| `getMatchesByStatus(status)` | For admin dashboard tabs |
| `getPlayerMatches(userId)` | All matches a player participated in |
| `createNotification(...)` | Write to notifications collection |
| `getUserNotifications(userId)` | Fetch user's notifications |
| `markNotificationRead(id)` | Mark as read |
| `subscribeToNotifications(userId, cb)` | Real-time listener |
| `updatePlayerStats(userId)` | Recompute and save stats from match history |

---

### Phase 2 — Match Creation & Player Join Flow

#### [NEW] `src/components/CreateMatchDialog.tsx`
Admin creates a casual match:
- **Inputs**: Match label, point target (default 21)
- **On create**: Generates two 4-letter join codes, creates Firestore doc with `status: "active"`, `phase: "setup"`
- **Result screen**: Shows both join codes and QR codes side by side
  - Team A QR → links to `/join/BVKR`
  - Team B QR → links to `/join/MXPL`
- Uses `qrcode` npm package for QR generation (lightweight, no server needed)

#### [NEW] `src/routes/join.$joinCode.tsx`
Player-facing join page:
```
┌──────────────────────────────┐
│     🏐 Grass Volleyball      │
│                              │
│   You're joining             │
│     ┌──────────────┐         │
│     │   TEAM A     │         │
│     │  Game 1 — Sunday       │
│     └──────────────┘         │
│                              │
│   [ Sign in with Google ]    │  ← If not logged in
│                              │
│   ── or ──                   │
│                              │
│   Welcome back, Fardeen!     │  ← If logged in
│   [ Join Team A ]            │
│                              │
│   Already joined:            │
│   • Alex H.                  │
│   • Sarah K.                 │
│                              │
└──────────────────────────────┘
```
- After joining → redirects to a "waiting room" or match view
- If code is invalid → shows error with option to enter manually

#### [DELETE] `src/components/QuickMatchDialog.tsx`
Replaced by `CreateMatchDialog`.

---

### Phase 3 — Scoring Control Panel (Mobile-First)

This is the largest change. The scoring page is entirely rewritten.

#### [MODIFY] [score/$matchId.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/score/%24matchId.tsx)

**Three sub-screens within the scoring page:**

---

**Screen 1: Pre-Match Setup** (`phase: "setup"`)

```
┌────────────────────────────────────┐
│  ← Back            Game 1         │
├────────────────────────────────────┤
│                                    │
│  TEAM A              TEAM B        │
│  Code: BVKR          Code: MXPL   │
│  [Show QR]           [Show QR]    │
│                                    │
│  ┌──────────┐    ┌──────────┐     │
│  │ • Alex ✓ │    │ • Dani ✓ │     │
│  │ • Bec  ✓ │    │ • Ed   ✓ │     │
│  │ • Cal  ✓ │    │ • Faz  ✓ │     │
│  │ • Jay  ✓ │    │ • Gem  ✓ │     │
│  │ • Kim    │    │ • Han    │     │
│  └──────────┘    └──────────┘     │
│  ✓ = active (tap to toggle)       │
│                                    │
│  Court Preview:                    │
│  ┌────┬────┐  ┌────┬────┐        │
│  │ P3 │ P4 │  │ P3 │ P4 │        │
│  ├────┼────┤  ├────┼────┤        │
│  │ P2 │P1🏐│  │ P1 │ P2 │        │
│  └────┴────┘  └────┴────┘        │
│    Team A        Team B            │
│                                    │
│  Drag players to reorder positions │
│                                    │
│  [ ☑ Recording ]  [ ☑ Ready ]     │
│  [    START MATCH    ]             │
└────────────────────────────────────┘
```

- Admin taps players to toggle active status (exactly 4 per team required)
- Drag-and-drop reordering within the active 4 to set positions
- Court preview shows current positioning
- Start Match → transitions to `phase: "live"`, plays whistle

---

**Screen 2: Live Scoring** (`phase: "live"`)

```
┌────────────────────────────────────┐
│       TEAM A    12 : 9    TEAM B   │
│                                    │
│  ┌─────────────────────────────┐   │
│  │      [Cal]    [Jay]         │   │
│  │      [Bec]    [Alex 🏐]    │   │
│  │  ─ ─ ─ ─ ─ NET ─ ─ ─ ─ ─  │   │
│  │      [Dani]   [Ed]         │   │
│  │      [Gem]    [Faz]        │   │
│  └─────────────────────────────┘   │
│                                    │
│  ┌─────────────────────────────┐   │
│  │     🔔 START SERVE          │   │  ← Big button, plays whistle
│  └─────────────────────────────┘   │
│                                    │  After serve pressed:
│  ┌──────────┐  ┌──────────┐       │
│  │  TEAM A  │  │  TEAM B  │       │  ← Point buttons
│  │  scored  │  │  scored  │       │
│  └──────────┘  └──────────┘       │
│                                    │
│  ┌─────────────────────────────┐   │
│  │ ⭐ Highlight     ↩ Undo    │   │
│  └─────────────────────────────┘   │
│                                    │
│  After tapping ⭐:                 │
│  ┌──────────────────────────────┐  │
│  │ Team A:  [Alex][Bec][Cal][Jay]│ │
│  │ Team B:  [Dani][Ed][Faz][Gem] │ │
│  │ [ 🏐 Match Highlight ]       │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Flow:**
1. **START SERVE** → plays whistle 🔊, records `{type: "serve", timestamp, servingTeam}`, hides serve button, shows point buttons
2. **TEAM A/B scored** → plays whistle 🔊, records `{type: "point", team, timestamp, scoreA, scoreB, servingTeam}`, applies side-out rotation if needed, shows serve button again
3. **⭐ Highlight** (optional, after a point) → expands player grid → tap player name → marks previous point event with `isHighlight: true, highlightPlayerId, highlightPlayerName`. Tap "Match Highlight" → sets `isHighlight: true` with no player.
4. **↩ Undo** → removes last event, reverses score/rotation

**Auto-rotation on side-out:**
- Side-out = receiving team wins the point
- The team that was NOT serving rotates clockwise: `[pos1, pos2, pos3, pos4]` → `[pos2, pos3, pos4, pos1]`
- Serve indicator (🏐) moves to the new pos1 player on the now-serving team
- Smooth CSS animation slides player cards to new positions

**Match end detection:**
- A team reaches `pointTarget` AND leads by ≥ 2
- "Match Complete" overlay appears with final score
- Admin taps "Confirm" → sets `phase: "complete"`, then `status: "action_required"`
- Navigates back to admin dashboard

---

**Screen 3: Between-game roster edit** (accessed from setup before starting)
- Admin can drag players within a team's roster to reorder positions
- Can toggle different players as active (if >4 on a team)
- Cannot move players between teams

#### [NEW] `src/components/CourtView.tsx`

Reusable court quadrant component:

```
Props:
  teamA: { name: string, players: MatchPlayer[], positions: string[4] }
  teamB: { name: string, players: MatchPlayer[], positions: string[4] }
  servingTeam: "A" | "B"
  interactive?: boolean    // Enable drag-and-drop reordering
  onReorder?: (team, newPositions) => void
```

- 2×2 grid per team, separated by a net line
- Position 1 (bottom-right for A, bottom-left for B) gets a serve indicator glow when that team is serving
- Player names displayed with first name + last initial
- On rotation: CSS `transition` animates cards sliding to new quadrant
- Team A on top, Team B on bottom (audience view — looking at the court)

#### [NEW] `src/hooks/useWhistle.ts`

Custom hook for whistle sound:
```typescript
export function useWhistle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    audioRef.current = new Audio('/whistle.mp3');
    audioRef.current.preload = 'auto';
  }, []);

  const play = () => audioRef.current?.play();
  return { play };
}
```

#### [NEW] `public/whistle.mp3`

Royalty-free referee whistle sound effect (~1 second). I'll source one — or you can drop yours in.

---

### Phase 4 — Admin Dashboard & Action Required Tab

#### [MODIFY] [manage/index.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/index.tsx)

Rewrite admin dashboard with **three tabs**:

```
┌──────────────────────────────────────────────┐
│  Admin Dashboard          [+ Create Match]   │
├──────────────────────────────────────────────┤
│  [ ACTIVE ]  [ ACTION REQUIRED ]  [ PROCESSED ]
├──────────────────────────────────────────────┤
```

**Tab 1: ACTIVE**
- Shows matches with `status: "active"` (both `phase: "setup"` and `phase: "live"`)
- Each card shows: label, teams, player count, score (if live), join codes
- Click → navigates to `/manage/score/{matchId}`
- "Create Match" button opens `CreateMatchDialog`

**Tab 2: ACTION REQUIRED** (the main new feature)
- Shows matches with `status: "action_required"`
- Click on a match → expands to show the **video processing panel**:

```
┌──────────────────────────────────────────────┐
│  Game 1 — Sunday Session     12 : 9          │
│  Team A vs Team B                             │
├──────────────────────────────────────────────┤
│                                               │
│  📹 Camera A (Team A perspective)             │
│  ┌─────────────────────────────────────┐     │
│  │                                     │     │
│  │    Drag & drop video here           │     │  ← Dropzone
│  │    or click to browse               │     │
│  │                                     │     │
│  └─────────────────────────────────────┘     │
│  Start time: [ 00:02:15 ]                    │  ← When first serve happens
│  [ Submit Camera A ]                          │  ← Uploads + triggers processing
│  Status: ✅ Trimmed video uploaded             │
│                                               │
│  📹 Camera B (Team B perspective)             │
│  ┌─────────────────────────────────────┐     │
│  │                                     │     │
│  │    Drag & drop video here           │     │
│  │                                     │     │
│  └─────────────────────────────────────┘     │
│  Start time: [ 00:03:42 ]                    │
│  [ Submit Camera B ]                          │
│  Status: ⏳ Processing (45%)                  │
│                                               │
│  ─────────────────────────────────────────    │
│  [ 🎬 Create Match Highlights ]               │  ← Enabled when ≥1 video processed
│  Creates combined highlight reel and moves    │
│  match to PROCESSED status                    │
└──────────────────────────────────────────────┘
```

**Flow:**
1. Admin clicks on match in Action Required tab
2. Panel expands showing Camera A and Camera B sections
3. For each camera:
   - Drag video file into dropzone → file uploads to Firebase Storage
   - Enter start time (MM:SS or HH:MM:SS) — the point in the raw video where the first serve whistle blows
   - Press "Submit" → creates processing job → triggers Cloud Run → shows progress bar
4. Once at least one perspective is uploaded and offset is submitted, "Create Match Highlights" button enables
5. Pressing "Create Match Highlights":
   - Triggers the highlight and trimmed match video generation jobs in Cloud Run.
   - If both perspectives are uploaded:
     - Trimmed Match Video is generated from the winning team's perspective.
     - Match Highlight reel alternates between Camera A and Camera B depending on which team scored.
   - If only one perspective is uploaded:
     - Both the Trimmed Match Video and the Match Highlight reel are generated using that single perspective.
   - On completion → uploads the two videos to YouTube, updates the match doc (setting `vodUrl` and `matchHighlightsUrl`), moves match `status` to `"processed"`, and sends notifications to all match participants.

**Tab 3: PROCESSED**
- Shows matches with `status: "processed"`
- Each card shows: label, score, links to YouTube videos (trimmed match, highlights)
- Click → navigates to match detail page

#### [MODIFY] [postmatch-process/$matchId.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/postmatch-process/%24matchId.tsx)

This route may be consolidated into the Action Required tab inline panel. If we keep it as a separate page, it will be updated to match the panel layout described above. Decision: **inline in the dashboard** for a smoother workflow — one less page to navigate.

---

### Phase 5 — Video Processing (Cloud Run Worker)

#### [MODIFY] [cloud-run/src/worker.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/cloud-run/src/worker.ts)

**Updated `POST /process` endpoint:**

Input payload:
```json
{
  "jobId": "abc123",
  "matchId": "match456",
  "perspectiveA": {
    "rawStoragePath": "matches/match456/raw_A.mp4",
    "videoOffset": 135
  },
  "perspectiveB": {
    "rawStoragePath": "matches/match456/raw_B.mp4",
    "videoOffset": 222
  },
  "winner": "A",
  "events": [
    { "type": "serve", "timestamp": 1718000000000, ... },
    { "type": "point", "timestamp": 1718000025000, ... }
  ]
}
```

*Note: One of perspectiveA or perspectiveB can be null/undefined if only one was uploaded.*

Pipeline:
1. **Download** raw video(s) from Firebase Storage.
2. **Align timestamps**:
   - For each available camera, map its first `serve` event timestamp to its respective `videoOffset` seconds.
   - Calculate all subsequent event timestamps relative to that anchor.
3. **Generate Trimmed Match Video**:
   - Determine which perspective to use: the winning team's perspective (e.g. A if Team A won, B if Team B won). If that perspective isn't available, fall back to the only available perspective.
   - Trim and concatenate all rallies from the chosen perspective (with 2s serve padding and 2s point padding).
   - Upload to YouTube: `"{matchLabel} — Full Match"`
4. **Generate Match Highlights Reel**:
   - Trim rally clips for all highlight events (where `isHighlight: true`).
   - For each highlight:
     - If both perspectives are available: use the scoring team's perspective.
     - If only one perspective is available: use the available perspective.
   - Concatenate all highlight clips.
   - Upload to YouTube: `"{matchLabel} — Match Highlights"`
5. **Update Firestore**:
   - Write YouTube URLs back to the match doc (`vodUrl` and `matchHighlightsUrl`).
   - Set status to `"processed"`.
   - Send notifications to all participants.

---

### Phase 6 — Match View, Player Profile & Notifications

#### [MODIFY] [match.$matchId.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/match.%24matchId.tsx)

Enhanced match detail page for players:

```
┌──────────────────────────────────────┐
│  ← Back        Game 1 — Sunday       │
├──────────────────────────────────────┤
│                                      │
│      TEAM A    12 : 9    TEAM B      │
│                                      │
│  ── Videos ──                        │
│  ▶ Trimmed Match Video               │  ← Embedded YouTube
│  ▶ Match Highlights                  │
│                                      │
│  ── Player Stats ──                  │
│  ┌────────────────────────────────┐  │
│  │ Player    │ Points │ Highlights│  │
│  │───────────┼────────┼───────────│  │
│  │ Alex      │   12   │    3      │  │
│  │ Bec       │   12   │    1      │  │
│  │ ...       │   ...  │   ...     │  │
│  └────────────────────────────────┘  │
│                                      │
│  ── Event Timeline ──                │
│  • 0:00  Serve (Alex 🏐)            │
│  • 0:23  Point → Team A (12-9) ⭐   │
│  • ...                               │
└──────────────────────────────────────┘
```

#### [MODIFY] [profile.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/profile.tsx)

Enhanced player profile:

```
┌──────────────────────────────────────┐
│  Player Profile                      │
│  ┌──────┐  Fardeen A.               │
│  │ 📷   │  fardeen@email.com         │
│  └──────┘                            │
├──────────────────────────────────────┤
│                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  67%   │ │  4/6   │ │  12%   │   │
│  │ Win %  │ │ Record │ │ HL Rate│   │
│  └────────┘ └────────┘ └────────┘   │
│                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  72    │ │   9    │ │   6    │   │
│  │ Points │ │  HLs   │ │Matches │   │
│  │ Played │ │Received│ │ Played │   │
│  └────────┘ └────────┘ └────────┘   │
│                                      │
│  ── Recent Matches ──                │
│  ◀ [Game 1 - W 21:15] [Game 2 ...] ▶│  ← Carousel (shadcn)
│                                      │
│  ── Activity ──                      │
│  🔔 Video processed for Game 1       │
│  🔔 You received a highlight!        │
└──────────────────────────────────────┘
```

Stats are computed from match history:
- **Win %** = matches won / matches played
- **Record** = wins / total
- **Highlight Rate** = highlights received / points played
- **Points Played** = sum of all points in matches where player was active
- **Highlights Received** = count of events with `highlightPlayerId === userId`

#### [NEW] `src/components/ActivityFeed.tsx`

Notification bell in the header:
- Badge shows unread count
- Dropdown lists recent notifications
- Click notification → navigates to match detail
- Stored in Firestore `notifications` collection
- Real-time listener via `onSnapshot`

#### [MODIFY] [SiteHeader.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/components/SiteHeader.tsx)

Add notification bell icon with unread badge next to the user avatar.

---

## Route Map (Final)

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Landing / home | Public |
| `/login` | Login page | Public |
| `/join/:joinCode` | **NEW** — Player join match | Public (prompts login) |
| `/match/:matchId` | **MODIFIED** — Match detail + video + stats | Authenticated |
| `/profile` | **MODIFIED** — Player stats + match carousel | Authenticated |
| `/manage` | **MODIFIED** — Admin dashboard (3 tabs) | Admin |
| `/manage/score/:matchId` | **REWRITTEN** — Scoring control panel | Admin |

---

## File Change Summary

| Action | File | Phase |
|--------|------|-------|
| MODIFY | [types.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/lib/types.ts) | 1 |
| MODIFY | [api.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/lib/api.ts) | 1 |
| NEW | `src/components/CreateMatchDialog.tsx` | 2 |
| NEW | `src/routes/join.$joinCode.tsx` | 2 |
| DELETE | [QuickMatchDialog.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/components/QuickMatchDialog.tsx) | 2 |
| REWRITE | [manage/score/$matchId.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/score/%24matchId.tsx) | 3 |
| NEW | `src/components/CourtView.tsx` | 3 |
| NEW | `src/hooks/useWhistle.ts` | 3 |
| NEW | `public/whistle.mp3` | 3 |
| REWRITE | [manage/index.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/index.tsx) | 4 |
| MODIFY/INLINE | [postmatch-process/$matchId.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/manage/postmatch-process/%24matchId.tsx) | 4 |
| MODIFY | [cloud-run/src/worker.ts](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/cloud-run/src/worker.ts) | 5 |
| MODIFY | [match.$matchId.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/match.%24matchId.tsx) | 6 |
| MODIFY | [profile.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/routes/profile.tsx) | 6 |
| NEW | `src/components/ActivityFeed.tsx` | 6 |
| MODIFY | [SiteHeader.tsx](file:///Users/alexhu/Documents/Github/Alex%20Work%20Space/coding/grass-volleyball/src/components/SiteHeader.tsx) | 6 |

---

## NPM Dependencies (New)

| Package | Purpose |
|---------|---------|
| `qrcode.react` | QR code generation for join links |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop for player roster reordering |

No other new deps — everything else (shadcn, Firebase, FFmpeg, YouTube API) is already installed.

---

## Verification Plan

### Automated Tests
```bash
npx vitest run   # Existing tests + new tests for:
                  # - Join code generation/collision avoidance
                  # - Rotation logic (clockwise, side-out only)
                  # - Score win detection (first to N, win by 2)
                  # - Player stats computation
```

### Manual Verification (End-to-End)
1. **Create match** → verify join codes generated, Firestore doc created
2. **Join via QR** → scan QR on phone → Google login → auto-joined to team
3. **Set roster** → select 4 active, drag to position, verify court view
4. **Score 5 points** → verify whistle plays, rotation on side-out, score updates in real-time
5. **Highlight attribution** → mark highlight, attribute to player, verify in events
6. **Match complete** → verify status transitions to `action_required`
7. **Video upload** → drag test video, set offset, submit → verify Cloud Run processes
8. **Match highlights** → press "Create Match Highlights" → verify YouTube upload
9. **Player profile** → verify stats computed correctly, match carousel populated
10. **Notifications** → verify bell badge updates, click navigates to match

### Timeline
| Day | Phase | Deliverable |
|-----|-------|-------------|
| Wed | 1 | Data model + API layer |
| Thu | 2–3 | Match creation + join flow + scoring UI |
| Fri | 3 | Scoring polish (rotation, whistle, highlights) |
| Sat AM | 4 | Admin dashboard + video upload |
| Sat PM | 5 | Cloud Run worker updates |
| Sat Eve | 6 | Profile + notifications + full dry run |
| Sun AM | — | Final fixes + deploy to Vercel |
