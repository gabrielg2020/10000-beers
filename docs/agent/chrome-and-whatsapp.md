# Chrome and WhatsApp Session Management

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

**Use case**: Set to 10-30 seconds on Raspberry Pi or slow VPS if seeing startup issues.
