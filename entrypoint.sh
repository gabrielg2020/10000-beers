#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema=src/database/schema.prisma

echo "Starting bot..."
exec node dist/index.js
