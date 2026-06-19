#!/usr/bin/env bash
set -e

# Antigravity Learning Platform Startup Script

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0;50m' # No Color
CLEAR='\033[0m'

echo -e "${BLUE}==================================================${CLEAR}"
echo -e "${GREEN}             STARTING LEARN PLATFORM               ${CLEAR}"
echo -e "${BLUE}==================================================${CLEAR}"

# 1. Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js first.${CLEAR}"
    exit 1
fi

# Get project root dir (directory where start.sh resides)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# 2. Check and install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Installing dependencies...${CLEAR}"
    npm install
fi

# 3. Generate Prisma client if missing
if [ ! -d "src/generated/prisma" ]; then
    echo -e "${YELLOW}Prisma client not found. Generating...${CLEAR}"
    npx prisma generate
fi

# 4. Run database setup (push schema, create triggers, seed)
bash scripts/db-setup.sh

# 5. Start the Next.js development server
echo -e "${GREEN}✓ Ready! Starting development server...${CLEAR}"
echo -e "${BLUE}Platform will be available at: ${GREEN}http://localhost:3000${CLEAR}"
echo -e "${YELLOW}Press Ctrl+C to stop the server.${CLEAR}"
echo -e "${BLUE}==================================================${CLEAR}"

# Trap SIGINT to exit cleanly
trap 'echo -e "\n${BLUE}Stopping server... Done.${CLEAR}"; exit 0' INT

npm run dev
