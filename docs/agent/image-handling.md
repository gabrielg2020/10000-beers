# Image Handling

## JPEG Only, Silent Ignore

**Why JPEG only**: Photos from camera roll or WhatsApp camera are JPEG. Want the bot to work seamlessly in existing group chats.

**Why silent ignore**: Keep group chat functional. People send GIFs, stickers, videos — don't want bot spam for every non-JPEG. Seamlessness principle.

**Check location**: messageHandler.ts:71-77 — silently return if `mimetype !== 'image/jpeg'`.

## File System Storage (Not Database)

**Why**:
1. **Database size**: Easier to make backups of core data without massive image blobs
2. **Future ML training**: Want to train custom beer detection model — images on disk are easier to move around than database queries
3. **Performance**: Faster backups, no BLOB queries

**Trade-off**: Lose some relational integrity, but gain flexibility and simplicity.

## Filename Structure

**Format**: `{timestamp}-{userId}-{randomSuffix}.jpg`

Example: `1234567890-abc123-def456.jpg`

**Why all three parts**:
- **timestamp**: Chronological sorting, uniqueness
- **userId**: Easy to identify image owner from filename alone — trade-off for not storing in database
- **randomSuffix**: Collision prevention (multiple submissions in same millisecond)

**Trade-off acknowledged**: Including userId in filename is redundant if you have the database, but makes file system browsing easier without DB queries.

## Image Hash (SHA256)

**Why SHA256**: Collision-resistant, fast, fixed size (64 hex chars), standard library support.

**Purpose**: Duplicate detection per user. Same hash = same image.

**Indexed**: `imageHash` column has database index for fast duplicate lookups.

## Orphaned Image Prevention

**Cleanup on duplicate**: If duplicate found, immediately delete the newly processed image.

**Cleanup on AI rejection**: If AI rejects, delete the image before throwing error.
