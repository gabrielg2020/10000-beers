# Error Handling

## Two-Message Pattern

**Every custom error has**:
1. **Technical message**: Logged, detailed, for debugging
2. **User message**: Sent to WhatsApp, friendly, human-readable

**Why separation**: Proven very useful. Technical message tells *what* went wrong, user message tells *how* it went wrong. Faster debugging without confusing users.

**Example**:
```typescript
throw new BeerSubmissionError(
  'Image hash already exists in database',  // Technical (logged)
  'DUPLICATE_SUBMISSION',                    // Code
  "You've already submitted this beer"      // User (WhatsApp reply)
);
```

## BeerSubmissionError vs Unexpected Errors

**BeerSubmissionError**: Expected failure modes (duplicate, AI rejection, user not found). Send the custom `userMessage` to WhatsApp.

**Unexpected errors**: Bugs or unhandled cases. Send generic "Something went wrong, please try again" and log full error.

**Why distinguish**: Unexpected errors signal bugs — "something I didn't account for". Helps identify issues beyond expected failure modes.

## Fail Fast Philosophy

**Config validation**: Check entire config at startup, exit immediately if invalid (config/index.ts:81-111).

**Why not lazy**: Rather fail quick than wait for problem to show up during runtime. If DATABASE_URL is wrong, know immediately, not when first beer is submitted.

**User experience**: Better to crash at startup (admin notices, fixes) than crash during active use (users frustrated).

## Graceful Shutdown

**Signal handling**: SIGINT, SIGTERM, uncaughtException, unhandledRejection all trigger graceful shutdown.

**Prevents multiple attempts**: `isShuttingDown` flag prevents duplicate shutdown attempts.

**Order**:
1. Destroy WhatsApp client
2. Wait 2 seconds (Chrome needs time to close)
3. Disconnect from database
4. Exit

**Why this order**: WhatsApp client holds Chrome processes. Must destroy before database disconnect, must wait for Chrome to fully close.
