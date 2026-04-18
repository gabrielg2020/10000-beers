# Testing
 
## Philosophy

Code coverage is not a good statistic. Tests should be written for the software, not as a second thought or to hit an arbitrary metric. Coverage is currently incomplete by design — tests exist where they protect meaningful business rules, not to pad numbers.
 
## What Meaningful Tests Look Like
 
Tests should protect the game, not just prove the code runs. A meaningful test validates a business rule. A useless test just checks a function doesn't throw.
 
**Three flows that must have tests when touched:**
 
**Submission integrity** — if a beer is submitted, it should appear exactly once in the database and the total count should reflect it. Test the full flow, not just individual service methods.
 
**Duplicate detection** — same image hash + same user = rejection. Different user = accepted. This protects leaderboard fairness. Test both cases explicitly.
 
**Undo window** — beer removed within 10 minutes = success. Beer removal attempted after 10 minutes = rejected. The time boundary is the rule, test the boundary not just the happy path.
 
**What a test should read like**: Given a user submits a beer, when they submit the same image again, then they receive a duplicate rejection and the total count does not increase.
 
## Singleton Services
 
**No testing issues**: Singleton services are easy to mock. Has been good for simplicity in practice.
 
