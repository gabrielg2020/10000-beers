# Multi-stage build for production efficiency
FROM node:20-bookworm-slim AS base

# Install dependencies for Chromium (required by Puppeteer/whatsapp-web.js)
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    procps \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Tell Puppeteer to skip downloading Chrome and use system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Dependencies stage
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install all dependencies (skip scripts, we'll run prisma generate manually)
RUN npm ci --ignore-scripts

# Build stage
FROM dependencies AS build

# Copy source code
COPY . .

# Generate Prisma client before building TypeScript
# Provide dummy DATABASE_URL for build time (actual URL provided at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate --schema=src/database/schema.prisma

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS production

# Copy package files
COPY package*.json ./

# Copy Prisma schema first
COPY --from=build /app/src/database/schema.prisma ./src/database/schema.prisma

# Install production dependencies (skip scripts)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Generate Prisma client manually
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate --schema=src/database/schema.prisma

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Copy AI system instruction file
COPY --from=build /app/src/system_instruction.md ./src/system_instruction.md

# Create directories for data persistence
RUN mkdir -p /data/images /app/.wwebjs_auth /app/.wwebjs_cache && \
    chown -R node:node /data /app

# Switch to non-root user for security
USER node

# Expose optional health check port (if implemented)
EXPOSE 3000

# Start the bot
CMD ["node", "dist/index.js"]
