# Design Principles
 
## The Goal
 
The group is collectively trying to reach **10,000 beers**. This is not a competition between users — it is a shared milestone. The leaderboard exists for fun and bragging rights, but the total count is what matters. Every design decision should protect the integrity of that number.
 
## Core Philosophy
 
**Honour system**: Trust users to submit real beers. The goal is collective fun, not competition. Friends sharing a beer can use the same photo — it's about tracking the group's total, not individual races.
 
**Seamlessness**: "You don't know the bot's there unless you need it." Stay silent on unknown commands, non-JPEG images, and anything that doesn't need a response. The group chat should function normally.
 
**Fail fast**: Validate all config at startup and exit immediately. Don't wait for runtime failures. If something's wrong, crash early.
 
**Cost optimisation**: Check for duplicates *before* AI validation to avoid paying for images that won't be counted anyway.
 
## Trade-offs Made
 
**90/10 rule**: Adding fields for future features during development pays off 90% of the time, causes dead code 10% of the time. Accept this ratio.
 
**Defensive design**: Handle failures gracefully (auto-accept on AI failure, soft delete users). Better to keep the game flowing than to be strict and require manual intervention.
 
**Practical over pure**: userId in image filenames is a trade-off for not storing images in the database — makes it easy to identify owner from filename alone.
