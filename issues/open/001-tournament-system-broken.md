# Tournament System Broken by Casual Match Rewrite

**Priority:** Low (future)  
**Created:** 2026-06-11  
**Status:** Open

## Description

The casual match system rewrite (Phases 1–6) breaks the existing tournament bracket/fixture system. The following features are non-functional after the rewrite:

## What's Broken

### Admin Dashboard (`/manage`)
- Tournament CRUD table removed (replaced by 3-tab match system)
- "Create Tournament" and "Edit Tournament" dialogs disconnected
- Test fixture generation button removed

### Fixture System (`api.ts`)
- `createFixtures()` — generates 8-team round-robin + bracket, references old Match schema
- `checkAndPopulateInitialPlacements()` — pool standings → placement seeding
- `updateNextRoundPlaceholders()` — winner/loser bracket progression
- `updateRankingsFromMatch()` — final rankings

### Standings
- `updateStandingsForMatch()` — pool play standings calculations
- All standings collection operations

### Team Registration
- `registerTeamToTournament()` — enforces 4-member teams, max 8 teams
- Tournament status transitions (`open` → `filled` → `complete`)

### Match Schema
- Old `Match.status` was `"scheduled" | "live" | "complete"` — now `"active" | "action_required" | "processed"`
- Old `Match.stage` (`pool`, `placement`, `final`) — no longer used
- Old `Match.teamA/teamB` were team **name strings** — now uses `teamAId/teamBId` references + `playersA/playersB` arrays

### Routes Affected
- `CreateTournamentDialog.tsx` — still exists but disconnected from dashboard
- `EditTournamentDialog.tsx` — same
- `TournamentModal.tsx` — tournament detail/registration modal
- `TournamentCard.tsx` — tournament card display

## What Needs to Happen to Restore

1. Re-add a "Tournaments" section to the admin dashboard (possibly a separate `/manage/tournaments` route)
2. Update fixture generation to use new Match schema (team IDs, player arrays)
3. Update standings to work with new team entity model
4. Bridge tournament teams ↔ casual match teams
5. Add tournament-level match configuration (sets per match, points per set)
6. Restore bracket visualization

## Related Files

- `src/routes/manage/index.tsx`
- `src/lib/api.ts` (fixture/standings functions)
- `src/lib/types.ts` (Tournament, Standing types)
- `src/components/CreateTournamentDialog.tsx`
- `src/components/EditTournamentDialog.tsx`
- `src/components/TournamentModal.tsx`
- `src/components/TournamentCard.tsx`
