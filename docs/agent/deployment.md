# Deployment

## Production Setup

**Where**: Raspberry Pi 4, running on local machine at home

**How**: Docker Compose with two services (production):
- `postgres` (PostgreSQL 16) — no port exposed to host, internal network only
- `bot` (Node.js application)

**Development overrides**: `docker-compose.dev.yml` adds:
- `pgadmin` (database admin UI on port 5050)
- Postgres port exposed on 5432

Run dev setup with:
```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Track record**: All smooth sailing so far. No crashes, no restores needed.

## Backups

**Location**: `/home/blu/backups/10000-beers/`

**Method**: Script pulls database backups

**Frequency**: Not specified (ask if needed for automation)

**Restores**: Never needed to restore. No incidents.

## Real-World Stats

- **~300 beers tracked** in production
- **Zero AI rejections** (auto-accept working well)
- **No orphaned images** (cleanup working)
- **No unexpected errors** (error handling comprehensive)
- **Honor system holding up** (no gaming attempts)
- **Leaderboard spam stopped** (admin-only working)

## Scale Considerations

**Current**: Small database, fast queries, no performance issues

**Future**: May see slowdown at 10,000+ beers. Monitor index performance.

**Image storage**: File system growing but manageable. Future ML training will need images on disk anyway.

## Chrome/Puppeteer on Pi

**Works but needs cleanup**: Chrome cleanup on startup is essential. Raspberry Pi sometimes struggles with Chrome processes not closing properly.

**STARTUP_WAIT**: May need to set this to 10-30 seconds on slower Pi models if seeing initialization issues.
