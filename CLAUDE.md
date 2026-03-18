## Current work
Ready for next feature

## Project
A bot which will be deployed in a group chat with my friends called '10,000 beers'. The aim is to send a photo of a beer when you drink one. This bot should keep track of how many beers have been drunk and who drunk them.
This project uses TypeScript with Postgres database. Core beer submission functionality is implemented.

## Structure
src/
  index.ts               - App entry point with graceful shutdown
  config/
    index.ts             - Centralised configuration loader with validation
    types.ts             - Configuration type definitions
  handlers/
    messageHandler.ts    - WhatsApp message routing and beer submission
  services/
    imageService.ts      - Image download, validation, storage, hashing
    userService.ts       - User creation and lookup
    beerService.ts       - Beer submission and duplicate detection
  database/
    schema.prisma        - Prisma schema (User, Beer models)
    client.ts            - Prisma client with query logging
  utils/
    logger.ts            - Pino logger configuration
    imageValidation.ts   - Image format and size validation
    fileSystem.ts        - File operations and error handling
  types/
    image.ts             - Image operation types
    submission.ts        - Beer submission types
tests/
  unit/
    services/            - Service layer tests (userService, beerService)
    handlers/            - Message handler tests
    utils/               - Utility function tests
  fixtures/images/       - Test image files
docker-compose.yml       - Local and production setup
Dockerfile               - Bot container image

## Tooling
- Biome for linting and formatting (biome.json) - do not suggest ESLint or Prettier
- Jest for testing with Supertest for endpoint tests
- Docker and docker-compose for local dev and production deployment
- Postgres 16 (via Docker) with Prisma ORM
- Winston or Pino for structured logging

## Services and Utilities
Always use existing services and utilities rather than duplicating logic:

**Services:**
- `userService.findOrCreateUser()` - Find or create user, update display name
- `userService.getUserBeerCount()` - Get beer count for specific user
- `userService.getTotalBeerCount()` - Get total beer count across all users
- `beerService.submitBeer()` - Full beer submission flow (validation, storage, DB)
- `beerService.checkDuplicate()` - Check for duplicate image submissions
- `imageService.processImage()` - Download, validate, store images from WhatsApp
- `imageService.calculateHash()` - SHA256 hash for duplicate detection
- `messageHandler.handleMessage()` - Process WhatsApp messages for beer submissions

**Configuration:**
- `config` - Centralised configuration singleton (loads from environment variables)
  - `config.application.*` - Node environment, log level, environment flags
  - `config.database.*` - Database connection URL
  - `config.whatsapp.*` - Group ID, admin IDs
  - `config.storage.*` - Image path, max size
  - `config.bot.*` - Cooldown minutes, reply behaviour

**Utilities:**
- `validateMimetype()` - Check image format (JPEG, PNG, WebP, GIF)
- `validateFileSize()` - Check image size limits
- `validateImageBuffer()` - Verify image file integrity
- `generateImageFilename()` - Create unique timestamped filenames
- `logger` - Pino structured logging (info, debug, warn, error)

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
- 62 tests passing (services, handlers, utils)
- Jest with ts-jest for TypeScript support
- All dependencies mocked (Prisma, WhatsApp client, file system)
- Required env vars set in tests/setup.ts for config module

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


