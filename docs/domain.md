# Domain Model

## Core Entities

### User
Represents a member of the '10,000 beers' WhatsApp group.

**Attributes:**
- `id` (UUID) - Internal primary key
- `whatsapp_id` (string, unique) - WhatsApp phone number ID (e.g., "447123456789@c.us")
- `display_name` (string) - Name shown in WhatsApp (may change)
- `nickname` (string, optional) - Custom nickname for stats display
- `created_at` (timestamp) - When user first submitted a beer
- `is_active` (boolean) - Whether user is still in group

**Business rules:**
- Users are created automatically on first beer submission
- `whatsapp_id` is the stable identifier (doesn't change)
- `display_name` should be updated if WhatsApp name changes
- Inactive users (left group) keep their history but marked `is_active = false`

**Relationships:**
- One user → many beers

### Beer
Represents a single beer submission.

**Attributes:**
- `id` (UUID) - Primary key
- `user_id` (UUID, foreign key) - Who submitted it
- `submitted_at` (timestamp) - When the beer was logged
- `image_path` (string) - Local path or cloud URL to image
- `image_hash` (string, optional) - SHA256 hash for duplicate detection
- `beer_type` (enum, nullable) - 'can', 'bottle', 'draught', null (unknown/pending classification)
- `classification_confidence` (float, nullable) - AI confidence score (0.0-1.0)
- `is_verified` (boolean) - Admin verification flag (future feature)
- `notes` (text, optional) - Future: user-provided notes (brewery, style, rating)

**Business rules:**
- Must have valid image (validated before save)
- Must pass AI beer detection if enabled (Gemini API, confidence ≥ 0.9)
- `submitted_at` defaults to message timestamp
- `beer_type` populated by AI classification (can, bottle, draught) if enabled
- Cannot delete beers (data integrity), admin commands for removal (future)
- Duplicate image detection via `image_hash` per user

**Relationships:**
- Many beers → one user

### BeerType (Enum)
Classification of beer container/serving method.

**Values:**
- `can` - Canned beer
- `bottle` - Bottled beer
- `draught` - Draught/tap beer (includes pints in glasses)

**Business rules:**
- Field is nullable (classification disabled or unavailable)
- AI classification via Gemini API (toggleable via AI_ENABLED config)
- Manual override by admins possible (future)

### GroupStats (Optional)
Aggregate statistics cached for performance.

**Attributes:**
- `id` (UUID) - Primary key
- `total_beers` (integer) - Total count
- `total_users` (integer) - Active users count
- `last_updated` (timestamp) - Cache timestamp
- `milestone_reached` (integer, nullable) - Last milestone hit (1000, 5000, etc.)

**Business rules:**
- Updated on each submission (increment counter)
- Recalculated daily for accuracy
- Used for "X beers until milestone Y" messages

**Note:** May not be needed initially - direct COUNT queries likely fast enough.

## Business Rules

### Submission Rules
1. **Valid submissions require:**
   - WhatsApp message with attached image
   - Image successfully downloads and saves
   - Image passes format and size validation
   - AI beer detection passes (if enabled: beer_detected=true, confidence≥0.9)
   - User is in the configured group chat
   - Cooldown period has passed (optional rate limiting)

2. **Duplicate handling:**
   - Same user cannot submit same image twice (via hash)
   - Multiple users can submit photos of same beer (social drinking)

3. **Rate limiting (optional):**
   - Max 1 submission per 5 minutes per user
   - Prevents spam/accidents
   - Configurable via environment variable

### Command Access
1. **Public commands** (anyone in group):
   - `!beer` - Submit beer with image
   - `!stats` - Group statistics
   - `!mystats` - Personal statistics
   - `!leaderboard` - Top beer drinkers

2. **Admin commands** (future):
   - `!verify <submission_id>` - Mark beer as verified
   - `!remove <submission_id>` - Invalidate submission
   - `!adduser @mention` - Manual user registration

### Statistics Rules
1. **Leaderboard:**
   - Ranked by total beers submitted
   - Only active users shown by default
   - Optional time period filters (weekly, monthly, all-time)

2. **Personal stats:**
   - Total beers
   - Rank in group
   - First beer date
   - Favourite beer type (if AI classification enabled)
   - Average beers per week

3. **Group stats:**
   - Total beers
   - Progress to next milestone (e.g., "234 beers until 5,000!")
   - Most active day/week
   - Distribution by beer type (future)

### Milestones
Celebrate group achievements at:
- 100, 500, 1,000, 2,500, 5,000, 7,500, 10,000 beers
- Bot sends celebratory message with stats when milestone reached

## Data Model (Prisma Schema Sketch)

```prisma
model User {
  id           String   @id @default(uuid())
  whatsappId   String   @unique @map("whatsapp_id")
  displayName  String   @map("display_name")
  nickname     String?
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")

  beers        Beer[]

  @@map("users")
}

model Beer {
  id                      String    @id @default(uuid())
  userId                  String    @map("user_id")
  submittedAt             DateTime  @default(now()) @map("submitted_at")
  imagePath               String    @map("image_path")
  imageHash               String?   @map("image_hash")
  beerType                BeerType? @map("beer_type")
  classificationConfidence Float?   @map("classification_confidence")
  isVerified              Boolean   @default(false) @map("is_verified")
  notes                   String?

  user                    User      @relation(fields: [userId], references: [id])

  @@map("beers")
  @@index([userId])
  @@index([submittedAt])
  @@index([imageHash])
}

enum BeerType {
  can
  bottle
  draught
}
```

## Key Queries

### Most Common Queries
1. **Submit beer:** `INSERT INTO beers ...`
2. **Get user stats:** `SELECT COUNT(*) FROM beers WHERE user_id = ?`
3. **Get leaderboard:** `SELECT user_id, COUNT(*) FROM beers GROUP BY user_id ORDER BY count DESC LIMIT 10`
4. **Get total count:** `SELECT COUNT(*) FROM beers`
5. **Check duplicate:** `SELECT id FROM beers WHERE user_id = ? AND image_hash = ?`

### Performance Considerations
- Index on `user_id` for user stats queries
- Index on `submitted_at` for time-based queries
- Index on `image_hash` for duplicate detection
- Compound index on `(user_id, submitted_at)` for user history

## Future Extensions

### Potential New Entities

**Brewery** (future)
- Track which breweries are popular
- Link beers to breweries
- Stats per brewery

**BeerStyle** (future)
- Lager, IPA, Stout, Porter, etc.
- More granular than can/bottle/draught
- Requires manual user input or advanced AI

**Comment/Reaction** (future)
- Social features
- Users can react to others' beer submissions
- Simple emoji reactions or text comments

**Challenge** (future)
- Group challenges ("100 beers in March")
- Individual challenges
- Rewards/badges

## Domain Constraints

### Hard Constraints (Enforced by Database)
- User must exist before submitting beer (foreign key)
- `whatsapp_id` must be unique
- `submitted_at` cannot be null
- `image_path` cannot be null

### Soft Constraints (Enforced by Application)
- Image file must exist at `image_path`
- Image must be valid format (JPEG, PNG, WebP)
- User must be in configured WhatsApp group
- Submission rate limits (if enabled)

### Invariants
- Beer count is always ≥ 0
- User's first beer date ≤ any of their beer submission dates
- Total beers = sum of all users' beer counts
- Active users only includes users currently in group

## Error Scenarios

### Invalid Submissions
- **No image attached:** Reply "Please attach a photo of your beer"
- **Image download fails:** Reply "Failed to process image, please try again"
- **AI rejects (not a beer or low confidence):** Reply "Doesn't look like a beer to me mate 🤔"
- **AI API failure:** Auto-accept (fail-open to honour system)
- **Duplicate image:** Reply "You've already submitted this beer"
- **Rate limited:** Reply "Slow down! Wait X minutes before submitting another"
- **Wrong group:** Bot ignores (no response)

### Data Integrity Issues
- **User leaves group:** Mark `is_active = false`, preserve history
- **Image file deleted:** Log error, preserve database record
- **Database connection lost:** Queue retries, alert admin
- **Duplicate submissions:** Last-write-wins or first-write-wins (decide during implementation)

## Implementation Details

### Timezone Handling
- **Storage:** All timestamps stored as UTC in database
- **Display:** Convert to UK time (GMT/BST) for user-facing messages
- **Library:** Use `date-fns-tz` or `luxon` for timezone conversion
- **Format:** "3 Mar 2026, 18:45 GMT" for stats display

### User Identity
- **Primary identifier:** WhatsApp ID (phone number, e.g., "447123456789@c.us")
- **Display name:** Auto-populated from WhatsApp, updates automatically
- **Nicknames:** Not implemented initially - use WhatsApp display name
- **Future:** Add `!setnick` command if requested

### Duplicate Detection
- **Method:** SHA256 hash of image file
- **Scope:** Per-user (same user cannot submit same image twice)
- **Allowed:** Different users can submit same image (social drinking)
- **Response:** "You've already submitted this beer"

### Admin Access
- **Configuration:** `ADMIN_IDS` environment variable
- **Format:** Comma-separated WhatsApp IDs
- **Privileges:** Future admin commands (verify, remove, manual imports)

### Historical Data Import
- **Requirement:** Import beers already posted to group before bot activation
- **Method:** One-time migration script or manual SQL inserts
- **Considerations:**
  - Images may be expired/unavailable in WhatsApp
  - Preserve original timestamps
  - Mark as historical import for auditability
  - Optional: add `imported_at` timestamp field

### Rate Limiting
- **Default:** Disabled (`SUBMISSION_COOLDOWN_MINUTES=0`)
- **Configurable:** Can enable 5-minute cooldown if needed
- **Scope:** Per-user
- **Storage:** In-memory cache (sufficient for 8 users)

### Bot Responses
- **Successful submission:**
  - Enabled: "Beer #1,234 logged for @User! 🍺"
  - Disabled: Silent (no reply, only logs)
  - Toggle: `REPLY_ON_SUBMISSION` env var
- **Errors:** Always reply with user-friendly message
- **Stats commands:** Always reply with results

### Image Handling
- **Accepted formats:** JPEG, PNG, WebP, GIF (first frame)
- **Max size:** 10MB (configurable via `MAX_IMAGE_SIZE_MB`)
- **Validation:** Check file integrity after download
- **Naming:** `{timestamp}-{userId}-{uuid}.jpg`
- **Storage:** `/data/images` (Docker volume)

## Assumptions

1. **Single group chat:** Bot only monitors one WhatsApp group (for now)
2. **Honest users:** No strict verification initially (honour system)
3. **Photo = beer:** AI classification is nice-to-have, not required
4. **No deletion:** Users cannot delete submissions (preserves milestones)
5. **Persistent storage:** Images stored forever (unless manual cleanup)
6. **UK-centric:** British English, UK timezone (GMT/BST) for display
7. **Small scale:** 8 users, no need for complex caching or queuing
