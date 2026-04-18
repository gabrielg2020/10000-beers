# AI Classification

## Fail Closed When AI Enabled

**Behaviour**: When `AI_ENABLED=true` and the Gemini API errors (network issues, parsing failures, etc.), the submission is **rejected** and the user is asked to retry. This prevents untrusted images bypassing validation.

**When AI disabled**: Auto-accept still applies — honour system as before.

## Confidence Threshold (default 0.9)

**High threshold intentional**: If `confidence >= 0.9`, trust the AI's `beerType` classification (can/bottle/draught).

**Below threshold**: Still accept the beer, but set `beerType = null`. Trust the user over uncertain AI. Better to have null than incorrect classification.

**Why accept at all**: Honour system. If a friend sent it, it's probably a beer even if the AI isn't confident.

## System Instruction in MD File

**Why separate file**: Quick iteration and testing. If changing models or services, can test fast and fail fast. Makes experimentation easier.

**Location**: `src/system_instruction.md` — loaded once at AI service initialisation (`aiService.initialise()`). Edits require a bot restart to take effect.

## Cider Counts as Beer

The classifier accepts both beer and cider as valid submissions and treats them equivalently. The JSON field is still named `beer_detected` for historical reasons — it returns `true` for either drink. Other alcoholic beverages (wine, spirits) are still rejected.

**Why**: Rejecting cider submissions feels arbitrary given the bot's casual, honour-system spirit.

## Cost Optimisation

Duplicate check happens *before* AI classification (see beer-submission-flow.md). Don't pay for API calls on images that won't be counted.

## Silencing AI Rejection Replies

`REPLY_ON_SUBMISSION=false` suppresses the "Doesn't look like a beer to me mate 🤔" reply on AI rejection. The image is still deleted and the rejection is still logged at warn level — only the WhatsApp reply is silenced. Useful when the group is sharing lots of non-beer photos and the bot's chatter becomes noise.

Other rejection paths (duplicate, generic failure) still reply regardless of this flag.
