# Deployment

## Production Setup

Docker Compose with two services:

- `postgres` (PostgreSQL 16) — no port exposed to host, internal network only
- `bot` (Node.js application)

## Development Overrides

`docker-compose.dev.yml` adds:

- `pgadmin` (database admin UI on port 5050)
- Postgres port exposed on 5432

Run dev setup with:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Migrations

Run automatically on container start via `entrypoint.sh` (`prisma migrate deploy`). If a migration fails, the bot won't start — fail fast by design.

The `--schema` flag is intentionally absent so Prisma 7 loads `prisma.config.ts` and picks up the runtime `DATABASE_URL`.

## Library Pinning

`whatsapp-web.js` is pinned to a community fork SHA, not the npm release. Upstream has a regression against current WhatsApp Web. See `chrome-and-whatsapp.md` for the full rationale before changing this pin.

## Backups

Beer history is game state — losing it cannot be undone. Back up the database regularly and test the restore path. Images grow unboundedly and are recoverable in the worst case (users still have the originals), so they can be backed up less aggressively.

Specifics (cron, offsite storage, healthchecks) are deployment-specific and not tracked in this repo.

## Chrome / Puppeteer

Chrome cleanup on startup is non-negotiable, not just defensive. See `chrome-and-whatsapp.md` for the full story including the `.wwebjs_cache` permission gotcha.

**STARTUP_WAIT**: Defaults to 0. Set to 10–30 seconds on slower hardware if seeing initialisation races.
