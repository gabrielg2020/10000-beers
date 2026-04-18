# Chrome and WhatsApp Session Management

## whatsapp-web.js Is Pinned to a Community Fork

**Current pin**: `package.json` → `github:timothydillan/whatsapp-web.js#d6dfff2a7280c2667f538d961df3b640bb2b90c4` (branch `fix/duplicate-events-and-bindings`).

**Why upstream is broken**: WhatsApp rolled out an A/B test on 28 January 2026 that stopped auto-loading the internal `WAWebSetPushnameConnAction` module on WhatsApp Web 2.3000.x. The official `whatsapp-web.js` library waits for that module during its post-authentication initialisation, so `client.emit('ready')` never fires. The `authenticated` event fires three times in a row as the underlying state machine retries, then the bot hangs indefinitely. Tracked upstream in pedroslopez/whatsapp-web.js#5758 and #127084 — both still open and unresolved as of April 2026.

**Why this fork**: `timothydillan` maintains a branch with 19 targeted commits addressing exactly this cluster of bugs — duplicate event listeners, polling for the missing module, attachEventListeners guards, and several store-fallback patches for the 2.3000.x bundle. It is the only working option that does not require migrating off `whatsapp-web.js` entirely.

**Pinned to a commit hash, not a branch**: never change the pin to `#fix/duplicate-events-and-bindings` (unpinned). The fork can move underneath the project. If the fork needs updating, fetch the new commit SHA explicitly.

**This is a temporary fix**. The fork is unofficial and could go unmaintained. The long-term plan is to migrate to `@whiskeysockets/baileys`, which talks WhatsApp's protocol directly instead of driving a Chromium instance. The trade-offs (ban risk, API surface, image handling rewrite) mean the migration is not trivial.

## .wwebjs_cache Host Directory Permissions

**Problem**: The fork's `LocalWebCache` writes the WhatsApp Web HTML bundle to `.wwebjs_cache/<version>.html` after the first successful auth. If the host directory is owned by root (Docker creates bind-mount targets as root if they don't exist), the in-container `node` user (UID 1000) cannot write the file. The cache write throws `EACCES`, the post-auth flow aborts with `Authentication failure`, and the session is destroyed mid-init.

**Symptom**: Logs show `Loading session from storage` followed immediately by `[wwebjs] Error in onAppStateHasSyncedEvent: EACCES: permission denied, open '.wwebjs_cache/<version>.html'` and then `Authentication failure`.

**Fix**: `sudo chown -R 1000:1000 .wwebjs_auth .wwebjs_cache` on the host. Then re-scan the QR.

**When this can resurface**: any time the `.wwebjs_cache` directory is recreated by Docker (e.g., after `docker compose down -v` or after manually `rm -rf`'ing the directory). If the bot dies mid-trip with "Authentication failure" right after a fresh QR scan, this is the most likely cause.

## Why Chrome Cleanup Exists

**Problem**: Chrome/Puppeteer don't play nice. Instances kept running even after graceful shutdown in both dev and production.

**Consequence**: Multiple instances signed into same WhatsApp session = things break.

**Solution**: Comprehensive cleanup on every startup (chromeCleanup.ts).

## Cleanup Strategy (3 levels)

**Almost always needed** — Chromium and Puppeteer have tendency to not play nice.

1. **Graceful wait (8 seconds)**: Check if Chrome process closed naturally
2. **SIGTERM (3 seconds)**: Politely ask process to terminate
3. **SIGKILL (last resort)**: Force kill — may corrupt session, but necessary if process won't die

**Real-world**: SIGKILL sometimes needed. Not just defensive — actually used in practice.

## Lock File Cleanup

**Files removed**: SingletonLock, SingletonSocket, SingletonCookie

**Why**: Stale lock files prevent new Chrome instances from starting. Clean them on every startup to guarantee fresh start.

## 2-Second Wait After Destroy

**Location**: index.ts:30-31 — wait 2 seconds after `client.destroy()` before exiting.

**Why**: Without it, new instance created instantly and tries to sign in = conflicts and problems.

**2 seconds arbitrary**: Chosen through trial. Long enough for Chrome to fully close, short enough to not annoy.

## Library Message ID Inconsistency

**Problem**: whatsapp-web.js sometimes picks up group ID, sometimes your own ID when testing with your own number.

**Only in dev**: Happens when using your own number for testing.

**Solution**: Check `message.fromMe` and ignore own messages in production (messageHandler.ts:26-30). Allow in dev for testing.

## Startup Wait Configuration

**STARTUP_WAIT env var**: Defaults to 0, but exists for slower computers.

**Why**: On slower machines, async/await couldn't account for initialization race conditions. Need time for everything to catch up.

**Use case**: Set to 10–30 seconds on slow hardware (Raspberry Pi, small VPS) if seeing startup issues.
