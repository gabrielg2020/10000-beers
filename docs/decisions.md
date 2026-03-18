# Architectural Decisions

## Technology Stack

### Database: PostgreSQL 16
**Decision:** Use Postgres from day one instead of SQLite.

**Rationale:**
- Handles concurrent writes properly (MVCC) - critical for simultaneous beer submissions
- No write locks that would block concurrent requests
- Docker deployment already planned, so Postgres container is trivial
- Same setup for dev and prod environments
- Avoids painful SQLite → Postgres migration later
- Better tooling and ORM support

**Trade-offs:**
- Slightly more complex than SQLite (connection pooling, Docker dependency)
- Acceptable because Docker is already required for deployment

### ORM: Prisma
**Decision:** Use Prisma for database access and migrations.

**Rationale:**
- Full TypeScript type safety with database schema
- Automated migrations with `prisma migrate`
- Excellent Postgres support
- Developer experience and productivity
- Prisma Studio for visual database browsing
- Mature ecosystem and comprehensive documentation

**Alternatives considered:**
- Drizzle: Lighter weight but smaller community
- TypeORM: More complex, less modern DX

### WhatsApp Integration: whatsapp-web.js
**Decision:** Already implemented, continue using.

**Known risks:**
- Requires Chromium/Puppeteer (resource heavy)
- Session management can be fragile
- WhatsApp may flag bot-like behaviour
- No official API

**Mitigations:**
- Implement health checks and auto-reconnect
- Persist `.wwebjs_auth` directory properly
- Throttle responses to avoid rate limits
- Abstract behind interface for potential future migration

### Image Storage: Local with Cloud Migration Path
**Decision:** Start with local filesystem storage, design for future cloud migration.

**Rationale:**
- Simpler to implement initially
- Homelab deployment has plenty of storage
- Can migrate to cloud (S3, R2) later if needed
- Avoids cloud costs during development

**Implementation:**
**Status: Completed** - Image storage system implemented with:
- Modular `ImageService` class with singleton instance
- Download from WhatsApp via `whatsapp-web.js` MessageMedia
- Validation: mimetype, file size (10MB default), buffer integrity checks
- Storage: `/data/images` mounted Docker volume
- Filename format: `{timestamp}-{userId}-{random}.{ext}`
- SHA256 hash calculation for duplicate detection
- Custom error types: `ImageServiceError`, `FileSystemError`
- Full unit test coverage (33 tests passing)

**Files:**
- `src/services/imageService.ts` - Main image processing service
- `src/utils/imageValidation.ts` - Format and size validation
- `src/utils/fileSystem.ts` - File operations with error handling
- `src/types/image.ts` - TypeScript interfaces
- `tests/unit/utils/` - Comprehensive unit tests

**Future considerations:**
- Cloud storage needed if multiple instances or off-site backup
- CDN if serving images to web interface

### Beer Submission System
**Decision:** Implement full beer submission flow with user management and duplicate detection.

**Status: Completed** - Core beer submission functionality implemented.

**Implementation:**
- **User Service** - Automatic user creation on first submission, display name sync
- **Beer Service** - Full submission flow with duplicate detection via image hash
- **Message Handler** - WhatsApp integration with group filtering and error handling
- **Type Safety** - Custom types for submissions, decoupled from WhatsApp library
- **Error Handling** - User-friendly error messages with detailed logging
- **Graceful Shutdown** - Proper cleanup of Puppeteer browser and database connections
- **Configuration** - Environment-based (REPLY_ON_SUBMISSION, WHATSAPP_GROUP_ID)

**Files:**
- `src/services/userService.ts` - User management (find/create, beer counts)
- `src/services/beerService.ts` - Beer submission logic and duplicate detection
- `src/handlers/messageHandler.ts` - WhatsApp message processing
- `src/types/submission.ts` - Submission types and custom errors
- `src/index.ts` - App initialization with graceful shutdown
- `tests/unit/services/` - Service layer tests (14 tests)
- `tests/unit/handlers/` - Handler tests (14 tests)

**Features:**
- Automatic user creation and display name updates
- SHA256-based duplicate detection per user
- Image cleanup on duplicate rejection
- Configurable reply behaviour
- Group-specific message filtering
- Comprehensive error handling and logging

**Future enhancements:**
- Rate limiting per user
- Milestone celebrations (100, 500, 1000 beers)
- Stats commands (!stats, !leaderboard)

### Concurrency: Async Handlers (No Queue)
**Decision:** Use simple async message handlers without a queue system.

**Rationale:**
- Expected load: 8 users, max ~80 submissions in one night
- Peak concurrent load: ~8 simultaneous submissions
- Postgres handles this concurrency easily
- WhatsApp-web.js already handles messages asynchronously
- Queuing is premature optimisation

**When to reconsider:**
- If image processing becomes slow (AI classification)
- If scaling to multiple group chats
- If external API integrations are added
- If lag is observed under real-world load

**Future queue option:** BullMQ (if needed)

### Deployment: Docker + docker-compose
**Decision:** Docker-based deployment from day one.

**Rationale:**
- Homelab deployment environment
- Consistent dev/prod environments
- Easy to manage Postgres + Bot containers
- Puppeteer dependencies isolated in container
- Volume mounts for data persistence

**Structure:**
```
docker-compose.yml:
  - postgres service (with pgdata volume)
  - bot service (with images volume)
  - pgadmin service (optional, for DB management)
```

### Logging: Pino
**Decision:** Use Pino for structured logging.

**Rationale:**
- Fastest logger for Node.js (important for async message handling)
- Structured JSON output by default (easy to parse)
- Production debugging essential for 24/7 bot
- Better performance than Winston
- Standard for modern Node.js applications

**Log levels:**
- ERROR: Failed submissions, WhatsApp disconnects, DB errors
- WARN: Rate limit hits, invalid submissions, authentication issues
- INFO: Successful submissions, stats queries, bot lifecycle
- DEBUG: Message parsing, command detection (dev only)

**Configuration:**
- Pretty-print in development (pino-pretty)
- JSON output in production
- Log to stdout (Docker captures)

### Configuration: .env files
**Decision:** Use dotenv for environment configuration.

**Rationale:**
- Standard Node.js pattern
- Works with docker-compose environment variables
- Easy to maintain different configs (dev, prod)

**Required variables:**
```
DATABASE_URL=postgresql://user:pass@postgres:5432/beers
WHATSAPP_GROUP_ID=...
IMAGE_STORAGE_PATH=/data/images
NODE_ENV=production
LOG_LEVEL=info
SUBMISSION_COOLDOWN_MINUTES=0
REPLY_ON_SUBMISSION=true
ADMIN_IDS=447123456789@c.us,447987654321@c.us
MAX_IMAGE_SIZE_MB=10
```

## Configuration Decisions

### Rate Limiting
**Decision:** Configurable cooldown via environment variable, default disabled.

**Implementation:**
- `SUBMISSION_COOLDOWN_MINUTES=0` (disabled by default)
- Can enable if spam becomes an issue
- Per-user cooldown tracked in memory or Redis (future)

### Bot Response Behaviour
**Decision:** Confirmation messages enabled by default, togglable via env.

**Implementation:**
- `REPLY_ON_SUBMISSION=true` (default)
- On success: "Beer #1,234 logged for @User! 🍺"
- Can disable if group finds it annoying
- Always log submission silently regardless of setting

### Admin Access
**Decision:** Hardcode admin WhatsApp IDs in environment variable.

**Implementation:**
- `ADMIN_IDS=447123456789@c.us,447987654321@c.us`
- Comma-separated list
- Admins can use future admin commands
- Easy to update without database changes

### Image Validation
**Decision:** Accept common formats with size limit and corruption checks.

**Accepted formats:**
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif) - static only, first frame extracted

**Validation rules:**
- Max file size: 10MB (`MAX_IMAGE_SIZE_MB=10`)
- Must be valid image (not corrupt)
- Reject if download fails from WhatsApp

### Duplicate Detection
**Decision:** Exact hash matching using SHA256.

**Implementation:**
- Calculate SHA256 hash of image file
- Check if user has already submitted this exact hash
- Prevents accidental double-posts
- Same beer photo can be submitted by different users (social drinking)

### Milestone Celebrations
**Decision:** Detailed message with stats when milestone reached.

**Milestones:** 100, 500, 1,000, 2,500, 5,000, 7,500, 10,000 beers

**Message format:**
```
🎉 {milestone} beers reached! 🍺

Top contributors:
1. @User1 - 487 beers
2. @User2 - 312 beers
3. @User3 - 201 beers

Next milestone: {next_milestone} ({beers_remaining} to go)
```

### Error Handling
**Decision:** User-friendly messages with technical details logged.

**User sees:**
- "Failed to save your beer, please try again"
- "Please attach a photo of your beer"
- "You've already submitted this beer"

**Logs contain:**
- Full error stack traces
- Request context (user ID, message ID)
- Timing information
- Environment details

## Code Architecture

### Modular Structure
**Decision:** Separate concerns into distinct modules.

**Structure:**
```
src/
  handlers/     - WhatsApp message handlers (command routing)
  services/     - Business logic (submissions, stats, user management)
  database/     - Prisma schema, client, migrations
  utils/        - Logging, config, helpers
  types/        - TypeScript type definitions
```

**Benefits:**
- Testability (mock services in handler tests)
- Clear separation of concerns
- Easy to navigate codebase
- Scalable as features grow

## Future Enhancements

### AI Image Classification
**Plan:** Add computer vision to classify beer type (can, bottle, draught).

**Approach options:**
1. **Cloud API** (Google Vision, AWS Rekognition)
   - Pros: Accurate, no model management
   - Cons: Cost per image, external dependency, latency

2. **Open-source model** (ResNet, MobileNet with custom training)
   - Pros: Free, runs locally, privacy
   - Cons: Need training data, less accurate, resource intensive

3. **Hybrid** - Generic object detection + heuristics
   - Detect "bottle", "can", "glass" objects
   - Use context (shape, colour) for classification

**Implementation timing:**
- After core features stable
- Requires decision on queue system (processing might be slow)
- Optional feature - honour system works initially

**Data model impact:**
- Add `beer_type` enum field: 'can' | 'bottle' | 'draught' | 'unknown'
- Add `classification_confidence` float field
- Allow manual override by admins

### Historical Data Import
**Plan:** One-time import of beers submitted before bot was active.

**Approach:**
- Users have already posted beer photos to group
- Create migration script to process historical messages
- Extract: sender, timestamp, image from old messages
- Import via SQL or Prisma seed script

**Implementation options:**
1. **Manual SQL inserts** - extract data, write INSERT statements
2. **WhatsApp message history parser** - scan chat export
3. **One-time bot scan** - bot reads old messages on first run

**Recommended:** Option 3 if possible, fallback to Option 1

**Data quality:**
- May not have images if WhatsApp auto-deleted old media
- Timestamps preserved from original message
- Mark historical imports with flag for auditability

### Potential Future Features
- Web dashboard for statistics
- Brewery/beer name tracking
- Social features (comments, reactions)
- Export data (yearly summaries)
- Multiple group support
- Beer style tracking (lager, IPA, stout, etc.)
- User timezone support (if expanding beyond UK)

## Decisions Deferred

### Historical Import Method
**Status:** To be decided after core features working.

**Options:**
1. Bot scans old WhatsApp messages on first run
2. Parse WhatsApp chat export file
3. Manual SQL inserts from extracted data

**Blockers:**
- Need to verify if WhatsApp media still available
- Determine message retention in group
- Test whatsapp-web.js message history access

### Testing Strategy
**Status: Implemented** - Comprehensive unit test coverage.

**Current implementation:**
- Jest with ts-jest for TypeScript support
- Unit tests in `tests/unit/` with mocked dependencies
- Arrange-Act-Assert pattern (blank lines, no comments)
- Coverage: 63 passing tests across services, handlers, and utils
- Test fixtures in `tests/fixtures/images/`
- Mocked dependencies: Prisma, WhatsApp client, file system, logger
- Service tests: userService (7 tests), beerService (7 tests)
- Handler tests: messageHandler (14 tests)
- Utility tests: imageValidation, fileSystem (35 tests)

**Future work:**
- Integration tests with real Postgres database
- E2E tests with test WhatsApp group
- Performance testing for concurrent submissions

### Backup Strategy
**Status:** To be decided before production deployment.

**Considerations:**
- Automated Postgres backups (pg_dump via cron)
- Image directory backups (rsync to NAS?)
- Backup retention policy (daily for 7 days, weekly for 4 weeks)
- Restore testing procedure
- Off-site backup (Backblaze B2, cloud storage)

### Monitoring & Alerting
**Status:** To be decided before production deployment.

**Considerations:**
- Health check endpoint (simple HTTP server on port 3000?)
- Uptime monitoring (UptimeRobot, self-hosted)
- Error alerting (Discord webhook, email, or separate monitoring chat)
- Metrics tracking (submissions per day, error rates, uptime)
- Log aggregation (local files vs external service)
