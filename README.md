# 10,000 Beers 🍺

A WhatsApp bot that tracks beer consumption for a group of friends. Send a photo of your beer, and the bot will log it with optional AI-powered beer type classification (can, bottle, or draught).

## Features

- Automatic beer tracking via WhatsApp image submissions
- Optional AI beer classification using Google Gemini
- Leaderboard and statistics tracking
- Undo last submission (10-minute window)
- Admin commands for beer removal
- PostgreSQL database with Prisma ORM
- Duplicate detection via image hashing
- Structured logging with Pino

## Documentation

For comprehensive guides and documentation, visit the **[Wiki](https://github.com/YOUR_USERNAME/10000-beers/wiki)**:

- **[Getting Started](https://github.com/YOUR_USERNAME/10000-beers/wiki/Getting-Started)** - Detailed setup instructions
- **[Configuration](https://github.com/YOUR_USERNAME/10000-beers/wiki/Configuration)** - Complete environment variable reference
- **[Architecture](https://github.com/YOUR_USERNAME/10000-beers/wiki/Architecture)** - System design and code structure
- **[Development Guide](https://github.com/YOUR_USERNAME/10000-beers/wiki/Development-Guide)** - Coding standards and contributing
- **[Commands](https://github.com/YOUR_USERNAME/10000-beers/wiki/Commands)** - All available bot commands

## Prerequisites

### Docker Setup

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Non-Docker Setup

- [Node.js](https://nodejs.org/) v20.x or higher
- [npm](https://www.npmjs.com/) v10.x or higher
- [PostgreSQL](https://www.postgresql.org/) v16.x or higher
- Chromium browser (for WhatsApp Web interface)

## Quick Start

### Docker Setup (Recommended)

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd 10000-beers
   cp .env.example .env
   ```

2. **Edit `.env` file**
   - Set `WHATSAPP_GROUP_ID` (see [Getting Group ID](#getting-whatsapp-group-id))
   - Set `ADMIN_IDS` (comma-separated WhatsApp IDs)
   - Update `POSTGRES_PASSWORD` for production

3. **Start services**
   ```bash
   docker compose up -d
   ```

4. **Authenticate WhatsApp (first-time only)**
   ```bash
   docker compose logs -f bot
   ```
   Scan the QR code with WhatsApp. Session will persist across restarts.

5. **Access pgAdmin (optional)**
   Navigate to `http://localhost:5050`
   - Email: `admin@localhost.com`
   - Password: `admin`

### Non-Docker Setup

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd 10000-beers
   cp .env.example .env
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL**
   ```bash
   # Create database
   createdb beers

   # Update .env with your database URL
   # DATABASE_URL=postgresql://username:password@localhost:5432/beers
   ```

4. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

5. **Edit `.env` file**
   - Set `WHATSAPP_GROUP_ID` (see [Getting Group ID](#getting-whatsapp-group-id))
   - Set `ADMIN_IDS` (comma-separated WhatsApp IDs)
   - Set `IMAGE_STORAGE_PATH` (defaults to `/data/images`)
   - Set `DATABASE_URL` to your PostgreSQL connection string

6. **Start development server**
   ```bash
   npm run dev
   ```
   Scan the QR code with WhatsApp. Session persists in `.wwebjs_auth/session-10000-beers/`.

7. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/beers` |
| `WHATSAPP_GROUP_ID` | WhatsApp group ID to monitor | `1234567890@g.us` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Execution environment (`development`, `production`, `test`) |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `ADMIN_IDS` | _(empty)_ | Comma-separated admin WhatsApp IDs |
| `IMAGE_STORAGE_PATH` | `/data/images` | Directory for storing beer images |
| `MAX_IMAGE_SIZE_MB` | `10` | Maximum image size in megabytes |
| `SUBMISSION_COOLDOWN_MINUTES` | `0` | Minimum time between submissions per user |
| `REPLY_ON_SUBMISSION` | `true` | Send WhatsApp reply on successful submission |
| `AI_ENABLED` | `false` | Enable AI beer classification |
| `AI_CONFIDENCE_THRESHOLD` | `0.9` | Minimum confidence for AI classification (0.0-1.0) |
| `GEMINI_API_KEY` | _(required if AI enabled)_ | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model to use |
| `STARTUP_WAIT` | `0` | Seconds to wait before initialisation |
| `PUPPETEER_EXECUTABLE_PATH` | _(auto-detected)_ | Path to Chromium executable |

### Docker-Only Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `beers_dev_password` | PostgreSQL database password |
| `PGADMIN_EMAIL` | `admin@localhost.com` | pgAdmin login email |
| `PGADMIN_PASSWORD` | `admin` | pgAdmin login password |

## Getting WhatsApp Group ID

1. Start the bot in development mode
2. Send a message in your group
3. Check the logs for group ID in format `1234567890@g.us` or `1234567890@lid`
4. Copy the ID to your `.env` file

## Available Commands

| Command | Description | Access |
|---------|-------------|--------|
| `!undo` | Remove your last beer submission (10-minute window) | All users |
| `!leaderboard` | Display beer leaderboard | Admin only |
| `!removeLast @user` | Removes that users last beer submission | Admin only |

## Development

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Database Management

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:prod

# Open Prisma Studio
npm run prisma:studio
```

### Project Structure

```
src/
├── index.ts              # Application entry point
├── config/               # Configuration loader and validation
├── handlers/             # Message and command routing
├── commands/             # Command implementations
├── services/             # Business logic (beer, user, image, AI, statistics)
├── database/             # Prisma schema and client
├── types/                # TypeScript type definitions
├── utils/                # Logging, validation, file operations
└── whatsapp/             # WhatsApp client factory

tests/
└── unit/                 # Unit tests with mocked dependencies
```

## Session Persistence

WhatsApp authentication persists across restarts:
- **Development**: `.wwebjs_auth/session-10000-beers/`
- **Docker**: Bind mount ensures session survives container restarts
- **First-time setup**: Scan QR code once, session saved automatically

## Troubleshooting

### QR Code Not Appearing

- Check logs: `docker compose logs -f bot` (Docker) or console output (non-Docker)
- Delete session: `rm -rf .wwebjs_auth/session-10000-beers/`
- Restart bot and re-scan QR code

### Database Connection Errors

- Verify PostgreSQL is running: `docker compose ps` or `pg_isready`
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Ensure migrations are applied: `npm run prisma:migrate`

### Image Storage Issues

- Verify `IMAGE_STORAGE_PATH` directory exists and is writable
- Check available disk space
- Docker: Ensure volume is properly mounted

### Chromium/Puppeteer Issues

- **Docker**: Chromium installed automatically in container
- **Non-Docker**: Install Chromium via package manager
  ```bash
  # Debian/Ubuntu
  sudo apt-get install chromium

  # macOS
  brew install chromium
  ```
- Set `PUPPETEER_EXECUTABLE_PATH` if auto-detection fails

## Licence

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built with 💻 by Gabriel Guimaraes

