# Database Design

## Soft Delete (isActive)

**Why not hard delete**: If someone leaves the group then gets re-added, keep their stats. No data loss.

**Implementation**: `isActive` boolean on User model, defaults to true.

**Current use**: Field exists but soft delete not actually implemented yet. No one has left/rejoined.

**Future**: Set `isActive = false` when user leaves, filter queries by `isActive = true`.

## Future Feature Fields

**Tried but not added**: Multiple fields exist for planned features that were started during development but not finished.

**Philosophy**: 90% of the time this pays off, 10% causes dead code. Acceptable trade-off.

### User.nickname
- **Planned**: Custom nicknames for leaderboard display
- **Status**: Field exists, never used
- **Why kept**: Might implement later

### Beer.isVerified
- **Planned**: Manual moderation flag
- **Status**: Always false, never set
- **Why kept**: Future admin review feature

### Beer.notes
- **Planned**: Admin notes on beer submissions
- **Status**: Always null, never used
- **Why kept**: Future moderation notes

### Beer.imageHash nullable
- **Why nullable**: Defensive — saw path where image service could fail
- **Reality**: Always set in practice, never actually null

## Display Name Updates

**Auto-update**: If user's WhatsApp display name changes, update in database (userService.ts:19-28).

**Why**: Leaderboard accuracy + data accuracy. Want database to match current username.

**Has it happened**: Preemptively added. Never caused a problem, never been needed yet.

## Indexes

Three indexes on Beer table:
- **userId**: Fast user beer lookups (leaderboard, counts)
- **submittedAt**: Chronological queries (recent submissions, undo window)
- **imageHash**: Duplicate detection

**Scale concerns**: Could be slow at scale. Prod database small now (~300 beers) but will grow. Monitor performance as it grows past 10,000 beers.

## Prisma Choice

**Why Prisma**: Battle-tested, industry standard, wanted to learn it.

**Alternatives considered**: TypeORM and raw SQL both considered but Prisma chosen for type safety and learning opportunity.

**Experience**: Singleton services with Prisma have been really good. No testing issues.
