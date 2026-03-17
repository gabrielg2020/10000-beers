## Current work
Set up image storing

## Project
A bot which will be deployed in a group chat with my friends called '10,000 beers'. The aim is to send a photo of a beer when you drink one. This bot should keep track of how many beers have been drunk and who drunk them.
This project uses TypeScript with a SQLite database. It's in very early development and not yet in production.

## Structure
src/
  index.ts           - App entry point
  handlers/          - WhatsApp message handlers
  services/          - Business logic (submissions, stats)
  database/          - Database schema and migrations
  utils/             - Logging, config, helpers
docker-compose.yml   - Local and production setup
Dockerfile           - Bot container image

## Tooling
- Biome for linting and formatting (biome.json) - do not suggest ESLint or Prettier
- Jest for testing with Supertest for endpoint tests
- Docker and docker-compose for local dev and production deployment
- Postgres 16 (via Docker) with Prisma ORM
- Winston or Pino for structured logging

## Utilities
Always use existing utilities rather than duplicating logic:

## Code style
- Tabs for indentation
- Single quotes for TypeScript
- ES module imports
- Always use type annotations
- Use type imports, regular imports for values
- Use descriptive camelCase suffixes for variables and filenames for TypeScript
- Use named exports
- Use comments sparingly, only where needed

## Testing
- Arrange-Act-Assert pattern (no comments, just blank lines between sections)
- Unit tests (tests/unit/) - business logic with mocked dependencies
- Separate test database for integration tests

## Security

## Do not
- Rewrite existing working fuctions unless asked
- Change error handling patterns without flagging it
- Add new dependencies without asking
- Rename files or reorganise folders without explicit instruction
- Read .env files
- Use the any type

## Further context
See /docs for domain model, data structure and architectural decisions:
- docs/domain.md - domain entities, business rules, data model
- docs/decisions.md - architectural and technology decisions with rationale


