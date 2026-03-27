# AI Classification

## Auto-Accept on Failure

**Why**: Matches behaviour when AI is disabled. Honour system — trust that photos sent are beers. If AI fails and we reject, someone would need to change `.env` and restart the bot. Kills the game flow.

**What fails**: Gemini API errors, network issues, parsing failures. All result in auto-accept with `beerType = null` and `confidence = 1.0`.

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
