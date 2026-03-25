## Project
WhatsApp bot for tracking beer consumption in a group chat. Users send photos of beers, bot logs them with optional AI classification.

**Tech stack:** TypeScript, PostgreSQL, Prisma ORM, WhatsApp Web (puppeteer), Google Gemini AI (optional)

**Documentation:** See [GitHub Wiki](https://github.com/gabrielg2020/10000-beers/wiki) for comprehensive guides

## Quick Setup
1. `npm install`
2. Configure `.env` (see `.env.example`)
3. `npm run dev` and scan QR code
4. Session persists in `.wwebjs_auth/session-10000-beers/`

For detailed setup: [Wiki - Getting Started](https://github.com/gabrielg2020/10000-beers/wiki/Getting-Started)

## Structure
```
src/
├── index.ts              - App entry point
├── config/               - Configuration loader and validation
├── handlers/             - Message and command routing
├── commands/             - Command implementations (!undo, !leaderboard, !removeLast)
├── services/             - Business logic (beer, user, image, AI, statistics)
├── database/             - Prisma schema and client
├── types/                - TypeScript type definitions
├── utils/                - Logging, validation, file operations
└── whatsapp/             - WhatsApp client factory
```

For detailed architecture: [Wiki - Architecture](https://github.com/gabrielg2020/10000-beers/wiki/Architecture)

## Tooling
- **Biome** for linting and formatting - do not suggest ESLint or Prettier
- **Jest** with ts-jest for testing
- **Docker** and docker-compose for deployment
- **PostgreSQL 16** with Prisma ORM
- **Pino** for structured logging

## Key Services
Always use existing services rather than duplicating logic:

- `beerService` - Beer submission, duplicate detection, removal
- `userService` - User creation, lookup, beer counts
- `imageService` - Image processing, validation, storage, hashing
- `aiService` - Gemini AI beer classification
- `statisticsService` - Leaderboard calculations
- `commandRegistry` - Command registration and execution

For service details: [Wiki - Architecture](https://github.com/gabrielg2020/10000-beers/wiki/Architecture#service-layer)

## Code Style
- Tabs for indentation, single quotes, named exports only
- Always use explicit type annotations
- Use `import type` for type-only imports
- Comments sparingly, only where needed
- Biome auto-formats on save

For detailed standards: [Wiki - Development Guide](https://github.com/gabrielg2020/10000-beers/wiki/Development-Guide)

## Commands
- `!undo` - Remove last beer submission (10-minute window, all users)
- `!leaderboard` (aliases: `!lb`, `!top`) - Show rankings (admin only)
- `!removeLast @user` - Remove user's last beer (admin only)

For command details: [Wiki - Commands](https://github.com/gabrielg2020/10000-beers/wiki/Commands)

## Configuration
Environment variables control all bot behaviour. Required: `DATABASE_URL`, `WHATSAPP_GROUP_ID`

For complete reference: [Wiki - Configuration](https://github.com/gabrielg2020/10000-beers/wiki/Configuration)

## Do Not
- Rewrite working functions unless asked
- Change error handling patterns without flagging
- Add new dependencies without asking
- Rename files or reorganise folders without explicit instruction
- Read .env files
- Use the `any` type
- Suggest ESLint or Prettier (use Biome)

