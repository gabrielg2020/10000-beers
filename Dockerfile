# Multi-stage build for production efficiency
FROM node:20-alpine AS base

# Install dependencies for Chromium (required by Puppeteer/whatsapp-web.js)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip downloading Chrome (use system chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Dependencies stage
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Build stage
FROM dependencies AS build

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS production

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Create directories for data persistence
RUN mkdir -p /data/images /app/.wwebjs_auth /app/.wwebjs_cache && \
    chown -R node:node /data /app

# Switch to non-root user for security
USER node

# Expose optional health check port (if implemented)
EXPOSE 3000

# Start the bot
CMD ["node", "dist/index.js"]
