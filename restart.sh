#!/usr/bin/env bash
set -e

echo "🛑 Killing all Next.js processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1

echo "🗑️  Clearing .next cache..."
rm -rf .next

echo "🗑️  Removing stale prisma/dev.db if present..."
rm -f prisma/dev.db

echo "🔄 Regenerating Prisma client..."
npx prisma generate

echo "✅ Pushing schema to database..."
npx prisma db push

echo "🌱 Running seed..."
npx tsx prisma/seed.ts

echo "🚀 Starting dev server..."
npm run dev