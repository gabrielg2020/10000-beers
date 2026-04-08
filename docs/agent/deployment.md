# Deployment

## Production Setup

**Where**: Migrating to a mini PC (8th gen i5, 16GB RAM, 256GB SSD) running Ubuntu Server. The original Raspberry Pi prod host is broken; the bot is running in an interim location until the mini PC arrives. See `backups-and-routine-tasks.md` for the migration timeline.

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

**Migrations**: Run automatically on container start via `entrypoint.sh` (`prisma migrate deploy`). If a migration fails, the bot won't start — fail fast by design. The `--schema` flag is intentionally absent so Prisma 7 loads `prisma.config.ts` and picks up the runtime `DATABASE_URL`.

**Library pinning**: `whatsapp-web.js` is pinned to a community fork SHA, not the npm release. Upstream is broken against current WhatsApp Web. See `chrome-and-whatsapp.md` for the full rationale before changing this pin.

## Track record

The bot was operationally smooth for several months but hit a hard wall in early 2026 when a WhatsApp A/B test broke the upstream `whatsapp-web.js` library's `ready` event flow. Worked around with a community fork pin (see `chrome-and-whatsapp.md`). The Pi hardware also failed around the same time, forcing the move to the mini PC. The "all smooth sailing" era is over; treat reliability as something that needs ongoing attention rather than something already solved.

## Backups and routine tasks

See **`backups-and-routine-tasks.md`** for the full design, migration timeline, and restore procedures. Summary:

- Three independent backup layers: mini PC local, always-on desktop pickup, Backblaze B2 offsite (DB only).
- 15-minute cadence on the database, nightly on images.
- Restore procedures and test instructions documented in the same file.
- **Until the mini PC is up and the new scripts are deployed, manual daily `pg_dump` is the stop-gap.** Do not rely on the existing `backup.sh` / `backup-remote.sh` / `backup-images.sh` scripts — they hardcode the broken Pi's IP and user.

## Real-World Stats

- **~300 beers tracked** at the time of the original snapshot; growing
- **Honour system holding up** — no gaming attempts observed
- **Zero AI rejections** historically (auto-accept working well)
- **No orphaned images** (cleanup working)

## Scale Considerations

**Current**: Small database, fast queries, no performance issues

**Future**: May see slowdown at 10,000+ beers. Monitor index performance.

**Image storage**: File system growing but manageable. Future ML training will need images on disk anyway.

## Chrome / Puppeteer

**Cleanup is essential**: Chrome cleanup on startup is non-negotiable, not just defensive. See `chrome-and-whatsapp.md` for the full Chrome/WhatsApp story including the `.wwebjs_cache` permission gotcha.

**STARTUP_WAIT**: Defaults to 0. Set to 10-30 seconds on slower hardware if seeing initialization races. Mini PC should not need it.
