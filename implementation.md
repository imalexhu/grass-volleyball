---
version: 0000
date: 2026-06-09
status: Genesis
based_on: 0000
changes: "Full implementation plan with data model, API layer, UI components, and migration strategy."
---

# Implementation Plan: Adelaide Grass Volleyball — Player + Team System

## Phase 0: Data Model Changes

### New Firestore Collections

#### `teams/{teamId}`
```ts
interface TeamDoc {
  id: string;
  name: string;
  captainId: string;            // Firebase Auth UID
  members: TeamMember[];        // exactly 4
  createdAt: number;            // Date.now()
  isActive: boolean;            // soft-delete / disband
}

interface TeamMember {
  userId: string;
  displayName: string;
  rating: PlayerRating;
  joinedAt: number;
}
```

#### Updated `users/{userId}` (UserProfile)
```ts
interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;               // "player" | "organization" | "admin"
  rating: PlayerRating;         // future — default "unrated", not used yet
  teamIds: string[];            // new — teams this player is on (max 3)
  joinedAt: number;
}
```

```ts
type PlayerRating = "unrated" | "bronze" | "silver" | "gold" | "platinum";
```

#### Updated `tournaments/{tournamentId}`
```ts
interface Tournament {
  // ... existing fields ...
  format: string;               // keep as display, but always "4v4 Pool Play + Finals"
  maxTeams: 8;                  // enforce locked to 8
  maxPlayersPerTeam: 4;         // new — enforce
  registeredTeams: TeamDoc[];   // embedded team snapshots (id, name, members[])
  // REMOVED: captain field from individual teams — captured in TeamDoc
}
```

#### New `teamInvites/{inviteId}` (optional v1.1 — skip for MVP)
// For v0, captain adds members directly via UI

### File changes:

**`src/lib/types.ts`** — Rewrite `Team`, update `UserProfile`, `Tournament`
**`src/lib/api.ts`** — Add: `createTeam`, `addTeamMember`, `removeTeamMember`, `getTeam`, `getUserTeams`, `getTeamsByTournament`, `registerTeamToTournament` (revised) + remove old team-array logic from `registerTeamToTournament`
**`src/lib/mockData.ts`** — Update mock tournaments to use new Team shape

---

## Phase 1: Backend / API Layer

### New API Functions in `src/lib/api.ts`

#### Teams CRUD
```ts
// Create a new team (creator becomes captain)
export const createTeam = async (name: string, creatorId: string): Promise<string>

// Get a single team by id
export const getTeam = async (teamId: string): Promise<TeamDoc | null>

// Get all teams a user belongs to
export const getUserTeams = async (userId: string): Promise<TeamDoc[]>

// Add a member to a team (captain only, enforces 4-player limit)
export const addTeamMember = async (teamId: string, userId: string): Promise<void>

// Remove a member from a team
export const removeTeamMember = async (teamId: string, userId: string): Promise<void>
```

#### Updated Tournament Registration
```ts
// Revised: registers a team (all 4 members) to a tournament
// Enforces: team has 4 members, tournament has space (< 8 teams)
export const registerTeamToTournament = async (tournamentId: string, teamId: string): Promise<void>

// New: get all teams registered for a tournament
export const getTournamentTeams = async (tournamentId: string): Promise<TeamDoc[]>
```

#### Player Profile
```ts
// Update player rating
export const updatePlayerRating = async (userId: string, rating: PlayerRating): Promise<void>
```

### Validation & Enforcement
- `registerTeamToTournament`: check `team.members.length === 4` before allowing registration
- `createFixtures`: only runs when `tournament.registeredTeams.length === 8`
- `addTeamMember`: reject if `team.members.length >= 4`
- Firestore security rules enforce the same limits (server-side)

### Firestore Security Rules (new/adjusted)
```
- teams/{teamId}: only captain can update; read by any authenticated user
- teams/{teamId}/members: validate array length ≤ 4 on write
- tournaments/{tournamentId}: validate registeredTeams.length ≤ 8 on write
- users/{userId}: user can read own profile; admin can update rating
```

---

## Phase 2: UI — Team Management

### New Routes

#### `/teams` — Team Browser / My Teams
- For a player: lists their teams, ability to create a new team
- Shows team name, captain, member count (X/4), record
- "Create Team" button → modal with team name input
- Empty state: "You aren't on any teams yet. Create one!"

#### `/teams/$teamId` — Team Detail Page
- Roster display (4 member cards with name, rating, captain badge)
- Captain controls: add member, remove member, transfer captaincy
- Tournament history (which tournaments this team played in)
- Match history for the team
- Invite link / add by username search (MVP: captain types display name to add)

#### `/teams/$teamId/edit` — Team Settings (captain only)
- Change team name
- Manage roster (add/remove)
- Disband team

### New Components

| Component | Purpose |
|---|---|
| `TeamCard` | Card showing team name, member count, captain, tournament count |
| `RosterGrid` | 4-slot display with player avatar, name, rating badge, captain crown |
| `AddMemberDialog` | Search/select a player by name to add to team |
| `CreateTeamDialog` | Name input → creates team with current user as captain |
| `PlayerRatingBadge` | Coloured badge (bronze/silver/gold/platinum) for rating display |

### Modified Components

**`TournamentModal.tsx`** — Replace the inline "Team name" + "Pay & Register" flow with:
- If user has teams: dropdown to select which team to register (must have 4 members)
- If user doesn't have a team: button → "Create a team first" → navigates to `/teams`
- Registration button: "Register [Team Name] ($80)"
- Show team members once registered

---

## Phase 3: UI — Player Profile / Ratings

### Updated Components

**`profile.tsx`** (read existing — it's a basic profile page)
- Add: Player rating display + badge
- Add: "My Teams" section (links to `/teams` and team detail pages)
- Add: Personal match history
- Admin view: ability to set/change rating

**`UserProfile` type changes propagate** through:
- `AuthContext.tsx` — create profile with `rating: "unrated"` and `teamIds: []`
- `register.tsx` — after auth, sets up initial profile
- `SiteHeader.tsx` — maybe show rating badge next to username

---

## Phase 4: Tournament Format Changes

### Enforcements in `src/lib/api.ts`

**`registerTeamToTournament`** — rewritten to:
1. Accept `tournamentId` + `teamId` (instead of raw Team object)
2. Fetch team doc, confirm `team.members.length === 4`
3. Check tournament's `registeredTeams.length < 8`
4. Embed team snapshot (`{id, name, members: [{userId, displayName, rating}]}`)
5. If 8 teams now registered, auto-set status → "filled"

**`createFixtures`** — update to use team ratings for seeding (optional enhancement):
- Sort teams by average rating → distribute across pools (snake draft)
- If all unrated → random shuffle (existing behaviour)

**`completeTournament`** — lock the tournament, archive team placements, finalize standings

### UI Enforcement

**`CreateTournamentDialog.tsx`** — Lock maxTeams to 8, default to 8, hide the field (or make it always-8)
**EditTournamentDialog.tsx** — Same treatment

---

## Phase 5: Migration Strategy

### Existing Data
- Old tournaments with inline `Team[]` (captain-only) will still render but show "Legacy team" badges
- No automated migration — old tournaments remain readable, new ones use the new system
- `getTeamInfo()` in API layer can be updated to also check the `teams` collection

### Order of Implementation

| Step | Description | Est. Complexity |
|---|---|---|
| **5.0** | Types: add TeamDoc, TeamMember, PlayerRating, update UserProfile, Tournament | Small |
| **5.1** | API: createTeam, getUserTeams, addTeamMember, removeTeamMember | Medium |
| **5.2** | UI: TeamCard, CreateTeamDialog, AddMemberDialog, team routes | Large |
| **5.3** | API: revised registerTeamToTournament, getTournamentTeams | Medium |
| **5.4** | UI: update TournamentModal registration flow (team dropdown) | Medium |
| **5.5** | UI: update profile page with rating + teams | Small |
| **5.6** | API: updatePlayerRating, Firestore rules | Small |
| **5.7** | Routes: profile page updates, manage page updates | Medium |
| **5.8** | Lock tournament format to 8 teams in create/edit dialogs | Small |
| **5.9** | Wire up Stripe checkout for team registration (per-player or flat) | Medium |
| **5.10** | Testing: create team → add members → register → fixtures → score → complete | Small |

---

## Phase 6: Adelaide-Specific Details

### Venue Registry
- Dropdown in tournament create/edit with pre-loaded Adelaide venues:
  - Glenelg Foreshore
  - Henley Beach
  - Bonython Park
  - West Beach Reserve
  - Semaphore Beach
  - Hahndorf Oval
  - Custom (free-text fallback)

### Player Grading (Adelaide rating system)
- Rating levels: Unrated → Bronze → Silver → Gold → Platinum
- Admin assigns ratings based on observed play
- Affects pool seeding in tournament fixture generation
- Displayed on player profile, team roster, match cards

### Tournament Naming Convention
- Suggest naming pattern: "Adelaide [Venue] [Season/Nickname]" in create dialog
- E.g. "Adelaide Summer Slam", "Glenelg Autumn Open"

---

## Files Modified (Full List)

| File | Change |
|---|---|
| `src/lib/types.ts` | Rewrite `Team`, update `UserProfile`, `Tournament` |
| `src/lib/api.ts` | +6 new functions, rewrite `registerTeamToTournament` |
| `src/lib/mockData.ts` | Update mock tournaments |
| `src/contexts/AuthContext.tsx` | Create profile with `rating` + `teamIds` |
| `src/routes/register.tsx` | No change needed (firebase auth stays same) |
| `src/routes/profile.tsx` | Add rating badge, My Teams section |
| `src/routes/team.$teamId.tsx` | Rewrite to use TeamDoc data model |
| `src/routes/teams/index.tsx` | NEW — team browser |
| `src/routes/teams/$teamId.tsx` | NEW — team detail |
| `src/components/TournamentModal.tsx` | Rewrite registration flow (team selector) |
| `src/components/CreateTournamentDialog.tsx` | Lock maxTeams=8, rating field? |
| `src/components/EditTournamentDialog.tsx` | Lock maxTeams=8 |
| `src/components/TeamCard.tsx` | NEW |
| `src/components/RosterGrid.tsx` | NEW |
| `src/components/AddMemberDialog.tsx` | NEW |
| `src/components/CreateTeamDialog.tsx` | NEW |
| `src/components/PlayerRatingBadge.tsx` | NEW |
| `src/routes/manage/index.tsx` | Add team/player management UI |
| Firestore security rules | Add team collection rules, enforce limits |

---

## Resolved Design Decisions

| # | Decision | Chosen Approach |
|---|---|---|
| 1 | **Payment** | Captain pays & registers the team as a unit (flat fee). Simple team-level payment. |
| 2 | **Player search** | Search users by display name / username. Captain types to find and add. |
| 3 | **Team persistence** | Teams persist across tournaments. A player can be on **up to 3 teams** simultaneously. |
| 4 | **Multiple teams per tournament** | 1 team per tournament max. Same player can be on different teams in different tournaments. |
| 5 | **Venues** | Skipped for now — keep free-text venue input. |
| 6 | **Player ratings** | Skipped. Elo system planned for the future. |
| 7 | **Invite flows** | MVP: captain directly adds known players via search. |

## Out of Scope (v0000)
- Mobile apps
- Player rating / Elo system
- Venue dropdown
- Team chat / messaging
- Guest / substitute player management
- Automated invite tokens