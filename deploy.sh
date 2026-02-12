#!/bin/bash
set -e

# Deep Mine — Deploy Script
# Uso: ./deploy.sh (rodar na raiz do projeto no servidor)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJ_DIR"

echo "═══════════════════════════════════════"
echo "  Deep Mine Deploy"
echo "═══════════════════════════════════════"

# ── 1. Git pull ──────────────────────────
step "Pulling latest code..."
git pull origin master || fail "git pull failed"
ok "Code updated"

# ── 2. Verificar .env ────────────────────
step "Checking server/.env..."
if [ ! -f server/.env ]; then
  fail "server/.env not found! Copy from .env.example and fill in real values"
fi
if grep -q "HOST:5432\|USER:PASSWORD\|your-secret" server/.env; then
  fail "server/.env has placeholder values! Edit it with real credentials"
fi
ok ".env looks good"

# ── 3. Build shared package ──────────────
step "Building shared package..."
cd "$PROJ_DIR/packages/shared"
npm install --silent 2>/dev/null
rm -rf dist/
npm run build || fail "Shared build failed"
ok "Shared package built"

# ── 4. Build server ─────────────────────
step "Building server..."
cd "$PROJ_DIR/server"
npm install --silent 2>/dev/null
npx prisma generate --schema=prisma/schema.prisma || fail "Prisma generate failed"
npx prisma db push --schema=prisma/schema.prisma || fail "Prisma db push failed"
rm -rf dist/
npm run build || fail "Server build failed"
ok "Server built"

# ── 5. Verificar que @shared foi resolvido
step "Verifying no unresolved @shared imports..."
if grep -rq "@shared" dist/ --include="*.js" 2>/dev/null; then
  grep -r "@shared" dist/ --include="*.js" | head -5
  fail "Found unresolved @shared imports in dist/"
fi
ok "All imports resolved"

# ── 6. Build client ─────────────────────
step "Building client..."
cd "$PROJ_DIR/client"
npm install --silent 2>/dev/null
rm -rf dist/
npm run build || fail "Client build failed"
ok "Client built"

# ── 7. Restart pm2 processes ─────────────
step "Restarting pm2 processes..."
cd "$PROJ_DIR/server"

# Server
if pm2 describe deepmine > /dev/null 2>&1; then
  pm2 restart deepmine
else
  pm2 start dist/main.js --name deepmine
fi
ok "Server restarted (port 9001)"

# Client
cd "$PROJ_DIR/client"
if pm2 describe deepmine-client > /dev/null 2>&1; then
  pm2 restart deepmine-client
else
  pm2 serve dist 3000 --name deepmine-client --spa
fi
ok "Client restarted (port 3000)"

# ── 8. Health check ──────────────────────
step "Running health check..."
sleep 3

# Check server is listening
if curl -sf http://localhost:9001/health > /dev/null 2>&1 || curl -sf -o /dev/null -w "%{http_code}" http://localhost:9001/ 2>/dev/null | grep -q "4\|2"; then
  ok "Server responding on port 9001"
else
  echo -e "${YELLOW}  ⚠ Server may not be ready yet — check: pm2 logs deepmine${NC}"
fi

# Check client is serving
if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
  ok "Client serving on port 3000"
else
  echo -e "${YELLOW}  ⚠ Client may not be ready yet — check: pm2 logs deepmine-client${NC}"
fi

# ── Done ─────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Server:  http://localhost:9001"
echo "  Client:  http://localhost:3000"
echo "  Logs:    pm2 logs"
echo ""
pm2 save
