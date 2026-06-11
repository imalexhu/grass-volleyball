# Unit Test Outline

All testable pure logic extracted from the casual match system. These test functions that have **no Firestore dependency** — pure input → output.

## Test File Structure

```
src/lib/
├── match-logic.ts          ← Pure functions (extracted from api.ts / scoring page)
├── match-logic.test.ts     ← Unit tests
├── video-logic.ts          ← Pure functions for video timestamp math
├── video-logic.test.ts     ← Unit tests
├── stats-logic.ts          ← Pure functions for player/team stats
└── stats-logic.test.ts     ← Unit tests
```

> [!TIP]
> By extracting pure logic into separate files, we keep `api.ts` as a thin Firestore wrapper and make all business logic independently testable.

---

## 1. Join Code Generation (`match-logic.ts`)

### `generateJoinCode() → string`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Returns a 4-character string | `code.length === 4` |
| 2 | All characters are uppercase A-Z | `/^[A-Z]{4}$/.test(code)` |
| 3 | Two consecutive calls produce different codes | `code1 !== code2` |
| 4 | Excludes confusing characters (O, I, 0, 1) if desired | No `O` or `I` in output |

### `isValidJoinCode(code: string) → boolean`

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Valid code | `"BVKR"` | `true` |
| 2 | Lowercase rejected | `"bvkr"` | `false` |
| 3 | Too short | `"BVK"` | `false` |
| 4 | Too long | `"BVKRX"` | `false` |
| 5 | Numbers rejected | `"BV4R"` | `false` |
| 6 | Empty string | `""` | `false` |

---

## 2. Court Rotation (`match-logic.ts`)

### `rotateClockwise(roster: string[4]) → string[4]`

Players rotate clockwise: position 1→2→3→4→1. The player in position 4 moves to position 1 (becomes server).

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Basic rotation | `["Cal","Jay","Alex","Bec"]` | `["Bec","Cal","Jay","Alex"]` |
| 2 | Double rotation | rotate twice from `["a","b","c","d"]` | `["c","d","a","b"]` |
| 3 | Full cycle (4 rotations) | rotate 4x from `["a","b","c","d"]` | `["a","b","c","d"]` |
| 4 | Single player IDs | `["u1","u2","u3","u4"]` | `["u4","u1","u2","u3"]` |

### Court Position Mapping

```
Team A (from admin view):    Team B (from admin view):
[P1]  [P2]                   [P3]  [P4]
[P4]  [P3]                   [P2]  [P1]
         ═══ NET ═══
```

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | `getCourtPosition("A", 0)` → top-left | `{row: 0, col: 0}` |
| 2 | `getCourtPosition("A", 1)` → top-right | `{row: 0, col: 1}` |
| 3 | `getCourtPosition("A", 2)` → bottom-right | `{row: 1, col: 1}` |
| 4 | `getCourtPosition("A", 3)` → bottom-left | `{row: 1, col: 0}` |
| 5 | `getCourtPosition("B", 0)` → bottom-right | `{row: 1, col: 1}` |
| 6 | `getCourtPosition("B", 1)` → bottom-left | `{row: 1, col: 0}` |
| 7 | `getCourtPosition("B", 2)` → top-left | `{row: 0, col: 0}` |
| 8 | `getCourtPosition("B", 3)` → top-right | `{row: 0, col: 1}` |

---

## 3. Side-Out Detection (`match-logic.ts`)

### `isSideOut(servingTeam: "A"|"B", scoringTeam: "A"|"B") → boolean`

| # | Test Case | Serving | Scored | Expected |
|---|-----------|---------|--------|----------|
| 1 | Serving team scores (no side-out) | `"A"` | `"A"` | `false` |
| 2 | Receiving team scores (side-out) | `"A"` | `"B"` | `true` |
| 3 | Serving team scores (no side-out) | `"B"` | `"B"` | `false` |
| 4 | Receiving team scores (side-out) | `"B"` | `"A"` | `true` |

### `getNextServingTeam(servingTeam: "A"|"B", scoringTeam: "A"|"B") → "A"|"B"`

| # | Test Case | Serving | Scored | Expected |
|---|-----------|---------|--------|----------|
| 1 | No side-out | `"A"` | `"A"` | `"A"` |
| 2 | Side-out | `"A"` | `"B"` | `"B"` |

### `applyPointResult(state, scoringTeam) → newState`

Full state transition test. State = `{ scoreA, scoreB, servingTeam, rosterA, rosterB }`.

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Team A serves, Team A scores | Score +1 A, no rotation, serve stays A |
| 2 | Team A serves, Team B scores (side-out) | Score +1 B, Team B rotates, serve → B |
| 3 | Team B serves, Team A scores (side-out) | Score +1 A, Team A rotates, serve → A |
| 4 | Team B serves, Team B scores | Score +1 B, no rotation, serve stays B |

---

## 4. Win Detection (`match-logic.ts`)

### `isMatchWon(scoreA: number, scoreB: number, pointTarget: number) → { won: boolean, winner?: "A"|"B" }`

Win condition: first to `pointTarget` AND lead by ≥ 2.

| # | Test Case | scoreA | scoreB | target | Expected |
|---|-----------|--------|--------|--------|----------|
| 1 | Team A reaches target | 21 | 15 | 21 | `{ won: true, winner: "A" }` |
| 2 | Team B reaches target | 18 | 21 | 21 | `{ won: true, winner: "B" }` |
| 3 | Target reached but not by 2 | 21 | 20 | 21 | `{ won: false }` |
| 4 | Deuce resolved | 23 | 21 | 21 | `{ won: true, winner: "A" }` |
| 5 | Still in deuce | 22 | 21 | 21 | `{ won: false }` |
| 6 | Neither at target | 15 | 12 | 21 | `{ won: false }` |
| 7 | Both at target, tied | 21 | 21 | 21 | `{ won: false }` |
| 8 | Low target (e.g., 5) | 5 | 3 | 5 | `{ won: true, winner: "A" }` |
| 9 | Zero scores | 0 | 0 | 21 | `{ won: false }` |

---

## 5. Score from Events (`match-logic.ts`)

### `computeScoreFromEvents(events: MatchEvent[]) → { scoreA: number, scoreB: number }`

| # | Test Case | Events | Expected |
|---|-----------|--------|----------|
| 1 | Empty events | `[]` | `{ 0, 0 }` |
| 2 | Single point A | `[serve, point(A)]` | `{ 1, 0 }` |
| 3 | Multiple points | `[serve, point(A), serve, point(B), serve, point(A)]` | `{ 2, 1 }` |
| 4 | Only serves (no points yet) | `[serve]` | `{ 0, 0 }` |

### `getServingTeamFromEvents(events: MatchEvent[]) → "A"|"B"`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | No events → default Team A serves first | `"A"` |
| 2 | Last event was point for B (side-out from A) | `"B"` |
| 3 | Last event was point for A (A was serving) | `"A"` |

---

## 6. Video Timestamp Alignment (`video-logic.ts`)

### `alignTimestamps(events: MatchEvent[], firstServeTimestamp: number, videoOffsetSeconds: number) → AlignedClip[]`

Converts match events (absolute timestamps from `Date.now()`) to video-relative timestamps.

Formula: `videoTime = videoOffsetSeconds + (event.timestamp - firstServeTimestamp) / 1000`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | First serve at offset 135s | First clip starts at 135s in video |
| 2 | Point 30s after first serve, offset 135s | Clip ends at 165s |
| 3 | 2s padding before serve | Clip start = max(0, videoTime - 2) |
| 4 | 2s padding after point | Clip end = videoTime + 2 |
| 5 | No events | Empty array |
| 6 | Serve without matching point (incomplete rally) | Excluded from output |

### `extractRallies(events: MatchEvent[]) → Rally[]`

Pairs serve events with their following point events.

| # | Test Case | Events | Expected |
|---|-----------|--------|----------|
| 1 | Complete rally | `[serve(t1), point(t2)]` | `[{ serveTime: t1, pointTime: t2 }]` |
| 2 | Multiple rallies | `[s1, p1, s2, p2]` | `[rally1, rally2]` |
| 3 | Trailing serve (no point) | `[s1, p1, s2]` | `[rally1]` — incomplete rally excluded |
| 4 | Highlight rally | `[s1, p1(highlight)]` | `[{ ..., isHighlight: true }]` |

---

## 7. Highlight Perspective Selection (`video-logic.ts`)

### `getHighlightPerspective(event: MatchEvent, playersA: string[], playersB: string[]) → "A"|"B"`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Player highlight, player on Team A | `"A"` |
| 2 | Player highlight, player on Team B | `"B"` |
| 3 | Match highlight (no player), Team A scored | `"A"` |
| 4 | Match highlight (no player), Team B scored | `"B"` |
| 5 | Only one perspective available | Return whichever is available |

---

## 8. Player Stats Computation (`stats-logic.ts`)

### `computePlayerStats(userId: string, matches: Match[]) → PlayerStats`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | No matches | `{ played: 0, won: 0, winPct: 0, highlights: 0, pointsPlayed: 0, hlRate: 0 }` |
| 2 | 1 match, player on winning team | `{ played: 1, won: 1, winPct: 100, ... }` |
| 3 | 2 matches, 1 win 1 loss | `{ played: 2, won: 1, winPct: 50, ... }` |
| 4 | Player has 3 highlights in 30 points | `{ hlRate: 10, highlights: 3, pointsPlayed: 30 }` |
| 5 | Player on Team A roster but match is incomplete | Excluded from stats |

### `computeTeamStats(teamId: string, matches: Match[]) → TeamStats`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | No matches | `{ played: 0, won: 0, winPct: 0 }` |
| 2 | Team won 3 of 5 matches | `{ played: 5, won: 3, winPct: 60 }` |

---

## 9. Match Label Auto-Generation (`match-logic.ts`)

### `generateMatchLabel(teamAName: string, teamBName: string) → string`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Standard names | `"Team A vs Team B"` |
| 2 | Custom names | `"Sharks vs Jets"` |
| 3 | Empty names | `"Team A vs Team B"` (fallback) |

---

## Summary

| Test File | Test Groups | Test Cases |
|-----------|-------------|------------|
| `match-logic.test.ts` | 7 groups | ~30 cases |
| `video-logic.test.ts` | 3 groups | ~15 cases |
| `stats-logic.test.ts` | 2 groups | ~10 cases |
| **Total** | **12 groups** | **~55 cases** |

All tests run via `npx vitest run` — already configured in the project.
