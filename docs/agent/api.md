# Go API and Adapter Architecture

## Why This Exists

The bot is being restructured from a single-process TypeScript WhatsApp bot into a Go HTTP API with thin platform adapters. Three reasons, in order of weight:

1. **Multi-platform readiness.** A user logging a beer should be able to use WhatsApp today and a Discord bot or iOS app tomorrow, sharing the same beer count. The current architecture couples business logic to `whatsapp-web.js` — no other client can ever participate.
2. **Cheap library swap later.** With business logic behind an HTTP API, swapping `whatsapp-web.js` for Baileys (or any other WhatsApp library) becomes purely an adapter-layer change. Today it would touch every service.
3. **Personal interest in writing Go.** Explicitly acknowledged. Treated as a side project to the side project — the live TypeScript bot keeps serving the paying group until the Go API has earned its place.

## What Would Break Without It

Nothing. The current bot has been running for 8+ weeks with zero downtime on the mini PC. This is a capability expansion, not a fix. The decision to take it on assumes the live bot is not the constraint.

## Known Edge Cases

- **Existing production data must migrate cleanly.** 8 weeks of beer history is tied to WhatsApp phone numbers. The migration backfills `user_identities('whatsapp', users.whatsapp_id)` for every existing user; nothing is rewritten. See [database.md](database.md) for the `isActive` and future-feature-field philosophy.
- **Image storage path is stable.** Existing image paths in the DB are absolute. The Go API mounts the same volume and uses the same filename format (`{timestamp}-{userId}-{randomSuffix}.jpg`). See [image-handling.md](image-handling.md).
- **AI behaviour must be preserved.** Fail-closed when AI is enabled, auto-accept when disabled, low-confidence accepts with `beerType = null`. See [ai-classification.md](ai-classification.md). The Go rewrite reuses the system instruction file verbatim.
- **Cutover happens one command at a time.** Both TS bot and Go API write to the same database during the cutover window. Sequencing commands one at a time (rather than big-bang) avoids race conditions and keeps each step independently reversible.
- **Reply rendering moves to the adapter.** Each platform formats differently — Discord has embeds, WhatsApp uses plain text with `*bold*`, iOS uses native UI. The API returns structured data and an error `code`; adapters render. This is the whole point of the split.

## Identity Model

Canonical users are decoupled from platform-specific IDs. A single canonical user can have multiple platform identities (WhatsApp phone, Discord snowflake, iOS account).

```
users
  id           uuid pk
  display_name text
  nickname     text?           (existing field, see database.md)
  is_admin     boolean         (new — replaces config.whatsapp.adminIds)
  is_active    boolean         (existing soft-delete field)
  created_at   timestamptz
  whatsapp_id  text            (legacy — kept until TS bot is decommissioned, then dropped)

user_identities                (new table)
  user_id            uuid fk users.id
  platform           text       ('whatsapp', 'discord', 'ios', ...)
  platform_user_id   text
  linked_at          timestamptz default now()
  primary key (platform, platform_user_id)
  index (user_id)
```

Staging:

- **V0 (now):** Auto-create one `users` row plus one `user_identities` row per new platform user. No cross-platform linking yet. WhatsApp-gabriel and Discord-gabriel are separate canonical users. Schema is already ready for linking.
- **V1 (when there's a real second platform):** Add a link-code flow. `!link` on WhatsApp returns a 6-digit code, valid 5 min. User runs `/link 482910` on Discord. Server merges the two `users` rows (re-point beers, delete the duplicate, both `user_identities` rows now share one `user_id`).
- **V2 (when iOS arrives):** Real accounts with email/OAuth login. Existing platform-link flow continues to work for binding a fresh iOS account to existing WA/Discord history.

Do not build V1 or V2 until they're needed.

## Admin Model

`users.is_admin` replaces the per-platform admin list. Admin is a property of the canonical user, not the platform identity — once accounts are linked, you're admin everywhere. Migration backfills `is_admin = true` for the users whose `whatsapp_id` is in the current `ADMIN_IDS` env var.

Adapters send `X-Platform-User-Id: <id>` on every request. The API resolves it to a canonical user and checks `is_admin` on admin-only endpoints (returns 403 if not). Adapters do not enforce admin client-side.

## Auth Between Adapter and API

`Authorization: Bearer <adapter-token>` on every request. The token identifies the platform (one token per adapter), so endpoints take a platform-user ID without needing the platform name in the path or body. Tokens live in each adapter's env. No per-user auth in V0; that arrives with V2 (iOS).

## Response Shape

API returns structured data and an error `code` (when applicable). Adapters render the user-facing message. Example:

```json
// POST /v1/beers — success
{ "beer_id": "...", "beer_number": 247, "user": { "display_name": "Gabriel" } }

// POST /v1/beers — duplicate
HTTP 409
{ "code": "DUPLICATE_SUBMISSION" }
```

The WA adapter knows that `DUPLICATE_SUBMISSION` renders as `"You've already submitted this beer"`. Discord might render it as an embed. iOS might show a toast. This is the entire point.

The existing two-message error pattern (technical + user-facing) survives, just split across processes: the API logs the technical message and returns the code; the adapter holds the user-facing string. See [error-handling.md](error-handling.md).

## Image Transport

Base64-encoded JSON for V1. The WhatsApp client already gives us base64 — passing it through to the API is a no-op. Multipart upload would be more efficient on the wire but adds encoding work to every adapter. Revisit only if image size becomes a measured bottleneck.

The API owns image storage: writes to disk, calculates hash, deletes on duplicate or AI rejection. Adapters never touch the filesystem. The storage volume is shared between TS bot and Go API during cutover (same path, same filename format) so existing images remain reachable.

## Schema Ownership During Cutover

Prisma continues to own migrations. The Go API connects to the same database via `pgx` and reads/writes the schema Prisma creates. This avoids dual-migration-tool coordination bugs while both processes run.

Schema ownership migrates to Go only after the TS bot is fully decommissioned (after step 7 of the migration plan). At that point, switch to `golang-migrate` and snapshot the final Prisma-managed schema as the starting migration.

## Repository Layout

Monorepo. One repo, multiple services in subdirectories. See the broader rationale: solo developer, atomic cross-service changes, open-source story.

```
api/                       Go HTTP API
adapters/whatsapp/         existing TS code, rehomed
shared/openapi.yaml        single source of truth for the API contract
docker-compose.yml         postgres + api + wa-adapter
ops/                       backup and deploy scripts (unchanged)
```

iOS will likely live in its own repo when the time comes — Xcode tooling doesn't share much with the backend, and the App Store provisioning story is its own beast.

## Deployment

One container per service, no bundling. Three containers in the compose file: `postgres`, `api`, `whatsapp-adapter`. When Discord arrives, add a fourth. They share an internal Docker network; only the API gets exposed publicly (when iOS arrives), behind a reverse proxy (Caddy is the easy choice).

Independent restart, independent deploy, independent log streams. If the WA adapter crashes from a `whatsapp-web.js` quirk, Discord keeps working. If the API needs a restart, both adapters reconnect on the next request.

## Endpoint Catalogue

All endpoints require `Authorization: Bearer <adapter-token>` and `X-Platform-User-Id: <id>` headers unless noted otherwise.

| Method | Path | Replaces | Notes |
|---|---|---|---|
| POST | `/v1/beers` | image-message path in `messageHandler.ts` | Body: `{ display_name, image: {mimetype, data_base64}, submitted_at? }`. Returns `{ beer_id, beer_number, user: { display_name } }` or error `code`. |
| DELETE | `/v1/beers/own/last` | `!undo` | Query: `?within_minutes=10`. Returns `{ beer_id, beer_number, display_name }` or `NO_BEERS`. |
| DELETE | `/v1/beers/by-platform-user/last` | `!removeLast @user` | Admin-only. Body: `{ target_platform_user_id }`. Adapter resolves the mention locally before calling. |
| GET | `/v1/leaderboard` | `!lb`, `!lb day\|week\|month\|weekend` | Admin-only. Query: `?period=` (omit for all-time). Returns `{ entries: [{ rank, display_name, total_beers }], total_beers, period_label }`. |
| GET | `/v1/stats` | `!stats day\|week\|month\|weekend` | Query: `?period=`. Returns dual `{ calendar, rolling }` or weekend variant `{ this_weekend?, last_weekend }`. |
| GET | `/v1/release` | `!release [version]` | Admin-only. Query: `?version=`. API performs the GitHub fetch and markdown strip. |
| GET | `/v1/health` | `healthcheck.js` | No auth. Returns `{ db: "ok", version }`. WA-connection liveness is now an adapter health concern, not the API's. |

## Tech Choices in Go

- **HTTP**: stdlib `net/http` with Go 1.22 routing. No framework dependency. Add `chi` only if routing gets painful.
- **DB**: `pgx` + `sqlc`. Write SQL, generate typed Go. Closest feel to Prisma without the magic.
- **Logging**: `slog` (stdlib structured logging).
- **AI**: Gemini Go SDK. System instruction file lives next to the binary in the same format as today.
- **Migrations**: Prisma during cutover; `golang-migrate` after TS bot is decommissioned.
