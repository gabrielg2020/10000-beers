# Beer Submission Flow

## 8-Step Process (beerService.ts)

**Why this order:**
1. Find/create user
2. Process image (download, validate, store, hash)
3. **Check for duplicates** ← BEFORE AI validation
4. AI validation (if enabled)
5. Create beer record
6. Get total count
7. Build success message
8. Reply (if enabled)

## Why Duplicate Check Before AI

**Cost optimisation**: Don't pay Gemini API for images that won't be counted anyway. Duplicates are rejected, so no point classifying them.

## Duplicate Detection: Per-User, Not Global

**Why per-user**: Honour system — if two friends are having a beer together and one forgets, they can use the same photo. Opens door to gaming, but that's acceptable. Goal is collective fun, not competition.

**Implementation**: Check `userId + imageHash` combination. Same image can be submitted by multiple users, but not by the same user twice.

**What happens**: If duplicate found, delete the newly processed image immediately. No orphaned images so far.

## Edge Cases

**AI failure**: Auto-accept and set `beerType = null`. Matches behaviour when AI is disabled. Keeps the game flowing without requiring bot restart or admin intervention.

**Low confidence**: If `confidence < threshold`, still accept the beer but set `beerType = null`. Trust the user over the AI. Better null than incorrect guess.
