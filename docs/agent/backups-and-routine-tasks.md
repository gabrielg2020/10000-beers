# Backups and Routine Tasks

## Status (as of 2026-04-07)

**Migration in progress.** The original Raspberry Pi prod host is broken. The bot is currently running in an interim location while a mini PC (8th gen i5, 16GB RAM, Ubuntu Server) is in transit. The proper prod environment does not yet exist. **Backups are not currently running** because the existing scripts hardcoded the Pi's IP and user — see "Stop-gap" below.

This document covers the agreed plan for what happens once the mini PC arrives, plus the steady-state operational reference for after the migration is done.

## Why this matters

The data is game state, not logs. Beer counts, timestamps, and leaderboard history cannot be reconstructed from any external source — losing them would feel like resetting a basketball game to 0-0 mid-play. The user has explicitly framed data loss as catastrophic. See `design-principles.md` for the broader integrity philosophy. As a concrete sizing data point: 40+ beers have been logged in a single 15-minute window during a group night out. This is the worst-case loss ceiling we are designing against.

## Stop-gap (do this now, before the mini PC arrives)

Wherever the bot is currently running, run a manual `pg_dump` of the prod database **at least once a day** until the proper backup chain is in place. One-liner against the running container:

```sh
docker exec beers-postgres pg_dump -U beers -d beers --clean --if-exists | gzip > db-$(date +%Y%m%d_%H%M%S).sql.gz
```

Copy the resulting file to a second location (USB drive, the desktop, anywhere that isn't the same disk). This is not the long-term plan — it is the bare minimum to avoid a single-disk failure wiping history while the mini PC is in transit.

## Migration timeline

The work splits across two interleaved tracks: **uptime** (healthchecks, stability) and **backups** (data protection). Both depend on the mini PC being live as prod, but some preparation can happen before it arrives.

### Phase 0 — Before the mini PC arrives

Things that don't need the new hardware and can be done now in spare evenings:

- **Stop-gap manual backups** (above). Daily, minimum.
- **Sign up for Backblaze B2**, create one bucket scoped to this project, generate a single application key with write access to that bucket only. Store the key ID and secret somewhere safe (password manager). Do not commit them.
- **Sign up for healthchecks.io** (or set up the self-hosted version if preferred). Create five checks ahead of time so the URLs are ready: `prod-db-dump-15min`, `prod-images-nightly`, `prod-b2-push-15min`, `desktop-pickup-15min`, `bot-whatsapp-alive`.
- **Draft the consolidated backup scripts** (see "Steady-state design" below). These can be written and reviewed without being deployed.
- **Draft the WhatsApp-aware healthcheck** (see `chrome-and-whatsapp.md` for the existing client setup). The current Docker healthcheck only validates the database, so the bot can be reported healthy while the WhatsApp client is dead.
- **Delete `backup-images.sh`** from the repo. It is a subset of `backup.sh` and adds nothing.

### Phase 1 — Mini PC base setup (day the hardware lands)

- Install Ubuntu Server. Hostname, SSH key auth, disable password login, basic firewall.
- Install Docker, Docker Compose, rclone, git.
- Configure rclone with the B2 credentials from Phase 0. Test with a dummy file: `rclone copy /tmp/test.txt b2:bucket-name/`.
- Clone the repo. Configure `.env` (keep `whatsapp-web.js` pinned to the existing fork SHA — see `chrome-and-whatsapp.md`).
- Smoke test: `docker compose up -d`, verify the postgres container starts and migrations run.

### Phase 2 — Bot cutover (one fraught moment)

This is the only step that involves real downtime and is hard to undo. Do it deliberately.

1. On the current interim host: run a fresh manual DB dump and copy it somewhere safe. This is the rollback point.
2. Stop the bot on the interim host (`docker compose down`).
3. Restore the DB dump into the mini PC's postgres container.
4. Either copy `.wwebjs_auth/` from the interim host to the mini PC (faster, may or may not work cleanly across machines) or accept that you'll need to scan a fresh QR on the mini PC (definitely works, costs ~30 seconds).
5. **Permission gotcha**: `sudo chown -R 1000:1000 .wwebjs_auth .wwebjs_cache` on the mini PC before starting. This is not optional — see `chrome-and-whatsapp.md`.
6. Start the bot on the mini PC. Wait for the `ready` event in the logs. Send a test message in the group.
7. If anything looks wrong, the rollback is: bring the interim host back up. Don't delete anything from the interim host until the mini PC has been stable for at least 48 hours.

### Phase 3 — Backups deployed (priority over healthcheck)

Backups go in before the healthcheck because right now the data has zero protection and the bot is functionally working. Data loss > uptime improvement.

1. Deploy the consolidated **prod-side backup script** (see "Steady-state design"). Three jobs: 15-min DB dump, nightly image tarball, 15-min B2 push.
2. Add the cron entries on the mini PC.
3. Verify the first cycle: check the local files appear, check the B2 bucket gets the dump, check the healthchecks.io dashboard turns green.
4. Deploy the **desktop-side pickup script** on the always-on desktop. Cron it to pull every 15 minutes.
5. Verify the desktop receives the dumps.
6. **Critical: do an actual test restore.** Pick a recent dump from each of the three locations (mini PC local, desktop, B2) and restore it into a throwaway postgres container. Verify row counts match. Untested backups are not backups.

### Phase 4 — WhatsApp-aware healthcheck deployed

1. Add a check to the bot that exposes the WhatsApp client state (e.g., last `ready` event timestamp, current connection state). The existing healthcheck script validates the DB only — extend it.
2. Update the Docker healthcheck config in `docker-compose.yml` to use the new logic.
3. Test by killing the Chrome process inside the container and verifying Docker auto-restarts it.
4. Add a `bot-whatsapp-alive` healthchecks.io ping from the bot itself (not from cron) so you find out if the *bot* dies, not just if backups stop running.

### Phase 5 — Measurement window (2-4 weeks)

Run the bot untouched and collect failure data. Categorise everything that goes wrong:

- Auth/session expiry
- Ready-event hang (the wwebjs bug we patched with the fork)
- Chrome crash / OOM
- Network/DNS
- Deploy regressions
- Database
- Hardware

The failure breakdown is the input to the Phase 6 decision. Don't skip this. See `MEMORY.md` → `project_uptime_plan.md` for the rationale.

### Phase 6 — Baileys decision

With real failure data in hand, revisit the question of migrating off `whatsapp-web.js` to `@whiskeysockets/baileys`. The trade-offs were already worked through in conversation (ban risk, image-handling rewrite, auth state format, no Chrome) — this phase is *implementation planning*, not relitigating the decision. See `MEMORY.md` → `project_wwebjs_fork_pin.md`.

If the failure data shows the bot is now stable on the fork and the bulk of remaining issues aren't library-related, Baileys can be deferred. If Chrome/Puppeteer is still the dominant failure source, Baileys becomes urgent.

## Steady-state design

Once Phase 4 is done, this is the operational picture.

### Backup topology

Three independent layers, each surviving a different class of failure.

| Layer | What | Where | Cadence | Survives |
|---|---|---|---|---|
| 1  | DB dump (gzipped) | Mini PC local disk | Every 15 min | Logical errors (bad migration, accidental delete) |
| 1b | Image tarball | Mini PC local disk | Nightly | Same |
| 2  | DB + images | Always-on desktop, pulled via rsync | Every 15 min DB / nightly images | Mini PC disk dying, theft, fire localised to one room |
| 3  | DB dump only | Backblaze B2 (prod pushes via rclone) | Every 15 min | Both machines gone — building-level disaster |

**Worst-case data loss: ~15 minutes**, bounded above by the 40-beer night-out figure. To actually lose history, all three layers would have to fail in the same 15-minute window.

### Why images are excluded from B2

Images grow forever and would accumulate real cost on B2 over time. They are also recoverable in the absolute worst case (users have the originals on their phones). The database is the irreplaceable thing because it carries the timestamps, counts, and history that cannot be reconstructed. Aggressive on the small critical data, lazy on the big replaceable data.

If image offsite ever becomes a priority, the right answer is an external SSD plugged into the desktop, not cloud storage.

### Script organisation

Two scripts replace the three current ones:

- `scripts/backup-prod.sh` — runs **on the mini PC**, parameterised by env vars. Handles the local DB dump, the local image tarball (when the cron entry says nightly), the B2 push, and per-job healthchecks.io pings. No hardcoded IPs or users.
- `scripts/backup-pickup.sh` — runs **on the desktop**. Pulls the latest DB dumps and image tarballs from prod via rsync. Refreshes the dev database as a side effect. Pings its own healthchecks.io URL.

The current `backup.sh`, `backup-remote.sh`, and `backup-images.sh` are deleted as part of the Phase 3 deployment.

### Cron layout

**On the mini PC:**

```cron
*/15 * * * *   /opt/10000-beers/scripts/backup-prod.sh db
0    3 * * *   /opt/10000-beers/scripts/backup-prod.sh images
*/15 * * * *   /opt/10000-beers/scripts/backup-prod.sh b2-push
```

**On the desktop:**

```cron
*/15 * * * *   /home/blu/code/10000-beers/scripts/backup-pickup.sh
```

Each script invocation pings its own healthchecks.io URL on success. healthchecks.io alerts if a ping is missing for longer than the configured grace period.

### Credentials

- **B2**: stored in `/etc/10000-beers/backup.env` on the mini PC, owned by root, mode `0600`. Sourced by `backup-prod.sh`. Never committed to the repo. Application key scoped to a single bucket.
- **healthchecks.io URLs**: same file, same permissions. They are not literally secret but they are credentials in the sense that anyone with the URL can falsify a healthy ping.
- **rclone config**: `~/.config/rclone/rclone.conf` on the mini PC, default permissions are fine.

## Restore procedures

The whole point of backups is restore, so the procedures live here. Test these at least once after Phase 3 deployment, and again any time the schema changes meaningfully.

### Restore the DB from a local dump

```sh
gunzip -c /var/backups/10000-beers/db-YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i beers-postgres psql -U beers -d beers
```

### Restore the DB from B2

```sh
rclone copy b2:10000-beers-backups/db-YYYYMMDD_HHMMSS.sql.gz /tmp/
gunzip -c /tmp/db-YYYYMMDD_HHMMSS.sql.gz \
  | docker exec -i beers-postgres psql -U beers -d beers
```

### Restore images

```sh
docker run --rm -v 10000-beers_images:/data/images \
  -v /var/backups/10000-beers:/backup alpine \
  tar xzf /backup/images-YYYYMMDD_HHMMSS.tar.gz -C /data
```

### Verify a restore

```sh
docker exec beers-postgres psql -U beers -d beers -c "SELECT COUNT(*) FROM \"Beer\";"
```

Compare against the count from before the failure (which is why you should be eyeballing the leaderboard total occasionally — it doubles as a sanity check).

## What this document is not

Not a substitute for actually testing the restore. Not a justification for skipping Phase 5's measurement window. Not a fixed schedule — the phases happen when they happen, in this order, with the mini PC arrival as the gating event.
