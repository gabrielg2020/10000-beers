## Read First
Before starting any task, read these files in order:
1. `docs/agent/design-principles.md` — the goal of the project and core philosophy
2. `docs/agent/beer-submission-flow.md` — the core flow and why it is ordered the way it is
3. The relevant scoped file for the area you are working in:
   - `docs/agent/commands-and-permissions.md` — working on commands
   - `docs/agent/image-handling.md` — working on image processing
   - `docs/agent/ai-classification.md` — working on AI validation
   - `docs/agent/database.md` — working on schema or queries
   - `docs/agent/error-handling.md` — working on error handling
   - `docs/agent/chrome-and-whatsapp.md` — working on WhatsApp client or session
   - `docs/agent/testing.md` — writing tests
   - `docs/agent/deployment.md` — working on Docker or deployment
   - `docs/agent/backups-and-routine-tasks.md` — working on backups, cron jobs, healthchecks, or the prod migration
 
Do not skip this step. These files contain the business context and decisions that are not visible from the code alone.
 
## Project
WhatsApp bot for tracking beer consumption in a group chat. Users send photos of beers, bot logs them with optional AI classification.
 
**Tech stack:** TypeScript, PostgreSQL, Prisma ORM, WhatsApp Web (puppeteer), Google Gemini AI (optional)
 
**Human documentation:** See [GitHub Wiki](https://github.com/gabrielg2020/10000-beers/wiki) for setup guides and architecture overview.
 
## Quick Setup
1. `npm install`
2. Configure `.env` (see `.env.example`)
3. `npm run dev` and scan QR code
4. Session persists in `.wwebjs_auth/session-10000-beers/`
 
## Structure
```
src/
├── index.ts              - App entry point
├── config/               - Configuration loader and validation
├── handlers/             - Message and command routing
├── commands/             - Command implementations (!undo, !leaderboard, !removeLast, !release)
├── services/             - Business logic (beer, user, image, AI, statistics)
├── database/             - Prisma schema and client
├── types/                - TypeScript type definitions
├── utils/                - Logging, validation, file operations
└── whatsapp/             - WhatsApp client factory
```
 
## Tooling
- **Biome** for linting and formatting — do not suggest ESLint or Prettier
- **Jest** with ts-jest for testing
- **Docker** and docker-compose for deployment
- **PostgreSQL 16** with Prisma ORM
- **Pino** for structured logging
 
## Key Services
Always use existing services rather than duplicating logic:
 
- `beerService` — beer submission, duplicate detection, removal
- `userService` — user creation, lookup, beer counts
- `imageService` — image processing, validation, storage, hashing
- `aiService` — Gemini AI beer classification
- `statisticsService` — leaderboard calculations
- `commandRegistry` — command registration and execution
 
## Code Style
- Tabs for indentation, single quotes, named exports only
- Always use explicit type annotations
- Use `import type` for type-only imports
- Comments sparingly, only where needed
- Biome auto-formats on save
 
## Commands
- `!undo` — remove last beer submission (10-minute window, own submissions only)
- `!leaderboard` (aliases: `!lb`, `!top`) — show rankings (admin only)
- `!removeLast @user` — remove a user's last beer (admin only, no time restriction)
- `!release` — show latest release notes from GitHub (admin only)
- `!stats <period>` — show group drinking statistics (everyone can use)
  - `!stats day` — today + last 24 hours
  - `!stats week` — this week + last 7 days
  - `!stats month` — this month + last 30 days
  - `!stats weekend` — this weekend + last weekend (Fri-Sun), or only last weekend (Mon-Thu)
 
## Configuration
Environment variables control all bot behaviour. Required: `DATABASE_URL`, `WHATSAPP_GROUP_ID`
 
## Do Not
- Rewrite working functions unless asked
- Change error handling patterns without flagging
- Add new dependencies without asking
- Rename files or reorganise folders without explicit instruction
- Read `.env` files
- Use the `any` type
- Suggest ESLint or Prettier (use Biome)
- Remove or rename unused database fields without asking — several exist intentionally for future features
- Refactor or clean up code that is not directly related to the current task
 
