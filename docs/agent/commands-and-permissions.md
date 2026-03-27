# Commands and Permissions

## Undo Command (!undo)

**10-minute window**: Rough estimate of time it takes someone to notice their photo was wrongly classified. Also prevents spam abuse — stops someone ruining the game by spamming `!undo`.

**Why anyone can undo own beer**: Removes *your* last submission. No mention of another user required. Low risk of misuse.

**Longer window risk**: Increases chance of misuse. 10 minutes balances "oops wrong photo" with "don't abuse the system".

## Remove Last Command (!removeLast @user)

**Admin-only + requires mention**: Removes *someone else's* last beer. Higher risk of misuse, so requires admin permission and explicit user mention.

**No time restriction**: Unlike `!undo`, admins can remove any user's last beer regardless of when it was submitted.

**Boundary**: `!undo` = self-service, `!removeLast` = admin action on others.

## Leaderboard Command (!leaderboard, !lb, !top)

**Why admin-only**: Was getting spammed. Annoying and cluttered the chat. Honour system can only take you so far.

**Before**: Any user could run it. Led to abuse.

**After**: Admin-only. Stops spam, keeps chat clean.

## Release Command (!release)

**Why it exists**: Admins can check latest bot changes without cluttering chat. Frees up conversation flow.

**How it works**: Fetches latest GitHub release via API, strips markdown, displays title + notes + link.

**Optional version**: `!release v1.0.0` fetches specific version instead of latest.

## Stats Command (!stats)

**Why it exists**: Group engagement and fun. Lets the group see their collective drinking stats, especially useful after a night out together.

**Why everyone can use it**: Low risk of spam (short output), encourages group participation. Unlike leaderboard which shows individual rankings and was spammed, this shows collective stats.

**Time periods**:
- `!stats day` — shows both today (midnight to now) and last 24 hours
- `!stats week` — shows both current week (Monday-Sunday) and last 7 days
- `!stats month` — shows both current month (1st to now) and last 30 days
- `!stats weekend` — shows this weekend + last weekend (Fri-Sun), or only last weekend (Mon-Thu)

**Top drinker**: The user who drank the most in that period. Shows group's top contributor for the timeframe.

## Unknown Commands

**Silent behaviour**: Don't reply. Seamlessness principle — "you don't know the bot's there unless you need it". Keeps chat clean.

**Logs**: Unknown commands logged at debug level for troubleshooting, but user sees nothing.
