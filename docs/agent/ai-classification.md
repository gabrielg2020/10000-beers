# AI Classification

## Fail Closed When AI Enabled

**Behaviour**: When `AI_ENABLED=true` and the Gemini API errors (network issues, parsing failures, etc.), the submission is **rejected** and the user is asked to retry. This prevents untrusted images bypassing validation.

**When AI disabled**: Auto-accept still applies — honour system as before.

**Real-world**: ~300 real beers tracked, zero rejections so far.

## Confidence Threshold (default 0.9)

**High threshold intentional**: If `confidence >= 0.9`, trust the AI's `beerType` classification (can/bottle/draught).

**Below threshold**: Still accept the beer, but set `beerType = null`. Trust the user over uncertain AI. Better to have null than incorrect classification.

**Why accept at all**: Honour system. If a friend sent it, it's probably a beer even if the AI isn't confident.

## System Instruction in MD File

**Why separate file**: Quick iteration and testing. If changing models or services, can test fast and fail fast. Hasn't changed since launch, but makes experimentation easier.

**Location**: `src/system_instruction.md` — loaded at AI service initialisation.

## Cost Optimisation

Duplicate check happens *before* AI classification (see beer-submission-flow.md). Don't pay for API calls on images that won't be counted.
