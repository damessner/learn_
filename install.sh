#!/usr/bin/env bash
# Learn Platform Installer
# curl -fsSL https://cdn.jsdelivr.net/gh/damessner/learn_@main/install.sh | bash
# curl -fsSL https://cdn.jsdelivr.net/gh/damessner/learn_@main/install.sh | bash -s -- -y
#
# Installs the Learn educational platform on Debian 13 (Trixie).
# License: MIT

set -e

# ----- Colors -----
YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
GN=$(echo "\033[1;92m")
DGN=$(echo "\033[32m")
CL=$(echo "\033[m")
BOLD=$(echo "\033[1m")
BFR="\\r\\033[K"
OFF="  "
CHECK="${OFF}✔️${OFF}"
CROSS="${OFF}✖️${OFF}"
INFO="${OFF}💡${OFF}"

# ----- Defaults (override via env) -----
INSTALL_DIR="${INSTALL_DIR:-/opt/learn}"
BRANCH="${BRANCH:-main}"
APP_PORT="${APP_PORT:-3000}"
LEARN_USER="${LEARN_USER:-learn}"
NODE_MAJOR="${NODE_MAJOR:-24}"
SKIP_PROMPTS=false

for arg in "$@"; do
  [[ "$arg" == "-y" || "$arg" == "--yes" ]] && SKIP_PROMPTS=true
done

TEMP_DIR=$(mktemp -d)
export DEBIAN_FRONTEND=noninteractive

# ----- Cleanup -----
cleanup() {
  rm -rf "$TEMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

err() {
  echo -e "\n${CROSS}${RD}Error: $*${CL}\n" >&2
  exit 1
}

msg()  { echo -ne "${OFF}${YW}${*}${CL}"; }
ok()   { echo -e "${BFR}${CHECK}${GN}${*}${CL}"; }
fail() { echo -e "${BFR}${CROSS}${RD}${*}${CL}"; }
note() { echo -e "${OFF}${INFO}${CL}${*}"; }

# ----- Header -----
header() {
  clear
  cat <<"EOF"

    __
   / /   ___  ____  _____
  / /   / _ \/ __ \/ ___/
 / /___/  __/ / / / /__
/_____/\___/_/ /_/\___/
                   v0.1.0
===============================
  Learn Platform Installer
  Debian 13 (Trixie)
===============================
EOF
}

# ----- Pre-flight checks -----
check_root() {
  [[ "$EUID" -eq 0 ]] || err "Must run as root (use sudo)."
}

check_debian() {
  [[ -f /etc/debian_version ]] || err "Only Debian-based systems supported."
  local ver
  ver=$(cut -d'.' -f1 < /etc/debian_version)
  [[ "$ver" == "13" ]] || err "Designed for Debian 13 (Trixie). Detected: $(cat /etc/debian_version)"
}

check_arch() {
  [[ "$(dpkg --print-architecture)" == "amd64" ]] || err "Only amd64 architecture supported."
}

check_ram() {
  local mem
  mem=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
  if [[ "$mem" -lt 1024 ]]; then
    note "Warning: ${mem}MB RAM detected. Build may be slow."
  fi
}

check_disk() {
  local free_kb
  free_kb=$(df "$(dirname "$INSTALL_DIR")" --output=avail 2>/dev/null | tail -1)
  [[ -z "$free_kb" || "$free_kb" -ge 2097152 ]] || err "Need at least 2GB free disk space."
}

# ----- Prompt helpers (whiptail with fallback) -----
prompt_yesno() {
  local title="$1" msg="$2" rc answer
  [[ "$SKIP_PROMPTS" == "true" ]] && return 0

  # Try whiptail (it opens /dev/tty directly — works with pipes)
  if command -v whiptail &>/dev/null; then
    whiptail --backtitle "Learn Platform Installer" \
      --title "$title" --yesno "$msg" 14 68 0</dev/tty 2>/dev/null
    rc=$?
    # 0=Yes, 1=No, other=failed (no /dev/tty etc.) — if it worked, return result
    [[ $rc -le 1 ]] && return $rc
  fi

  # Fallback: read from /dev/tty
  if exec <>/dev/tty 2>/dev/null; then
    echo ""
    echo "=== $title ==="
    echo -e "$msg"
    echo -n "[Y/n] "
    read -r answer
    [[ "${answer,,}" != "n" && "${answer,,}" != "no" ]]
    return $?
  fi

  # No terminal — auto-yes for non-interactive
  return 0
}

prompt_input() {
  local title="$1" msg="$2" default="$3" rc val
  [[ "$SKIP_PROMPTS" == "true" ]] && { echo "$default"; return 0; }

  if command -v whiptail &>/dev/null; then
    val=$(whiptail --backtitle "Learn Platform Installer" --title "$title" \
      --inputbox "$msg" 10 60 "$default" 0</dev/tty 3>&1 1>&2 2>&3)
    rc=$?
    # 0=OK with input, 1=Cancel/Skip — return whatever was entered
    [[ $rc -le 1 ]] && { echo "$val"; return 0; }
  fi

  if exec <>/dev/tty 2>/dev/null; then
    echo ""
    echo "=== $title ==="
    echo -e "$msg"
    echo -n "[$default] "
    read -r val
    echo "${val:-$default}"
    return 0
  fi

  echo "$default"
}

# ----- Guided config -----
get_config() {
  local USE_NGINX=false DOMAIN="" USE_SSL=false

  if prompt_yesno "Welcome" \
    "This will install the Learn Platform on your Debian 13 system.

Components:
  - Node.js ${NODE_MAJOR}.x + npm
  - Python 3 + TTS engine (kokoro-onnx)
  - Git clone from GitHub
  - Prisma database setup (SQLite)
  - systemd service (learn)
  - Optional: nginx reverse proxy + Let's Encrypt SSL

Target directory: ${INSTALL_DIR}

Proceed with installation?"; then
    :
  else
    header
    echo -e "\n${CROSS}${RD}Installation cancelled by user${CL}\n"
    exit
  fi

  if prompt_yesno "Reverse Proxy" \
    "Set up nginx as a reverse proxy?

This proxies port 80/443 to the app on port ${APP_PORT}.
Recommended for production."; then
    USE_NGINX=true
  fi

  if [[ "$USE_NGINX" == true ]]; then
    local d
    d=$(prompt_input "Domain Name" \
      "Enter your domain name (e.g., learn.example.com)
Leave blank to use the server IP address." "")
    DOMAIN=$(echo "$d" | tr -d ' ' | tr '[:upper:]' '[:lower:]')

    if [[ -n "$DOMAIN" ]]; then
      if prompt_yesno "SSL Certificate" \
        "Set up Let's Encrypt SSL for ${DOMAIN}?

Requires the domain to be publicly resolvable on port 80."; then
        USE_SSL=true
      fi
    fi
  fi

  # Export for downstream steps
  export USE_NGINX DOMAIN USE_SSL
}

# ----- Install steps -----
step_prereqs() {
  msg "Updating package lists..."
  apt-get update -qq >/dev/null 2>&1
  ok "Package lists updated"

  msg "Installing system packages..."
  apt-get install -y -qq \
    curl wget git \
    python3 python3-pip python3-venv \
    build-essential pkg-config \
    whiptail >/dev/null 2>&1
  ok "System packages installed"
}

step_node() {
  if command -v node &>/dev/null; then
    local nv
    nv=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    [[ "$nv" -ge 18 ]] && { ok "Node.js $(node --version) already installed"; return; }
  fi
  msg "Installing Node.js ${NODE_MAJOR}.x..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  ok "Node.js $(node --version) installed"
}

step_tts() {
  msg "Installing Python TTS engine (kokoro-onnx)..."
  pip3 install --break-system-packages --quiet kokoro-onnx numpy >/dev/null 2>&1
  ok "TTS dependencies installed"
}

step_user() {
  msg "Creating system user '${LEARN_USER}'..."
  if ! id -u "$LEARN_USER" &>/dev/null; then
    groupadd -f "$LEARN_USER"
    useradd -r -g "$LEARN_USER" -d "$INSTALL_DIR" -s /usr/sbin/nologin "$LEARN_USER"
  fi
  ok "User '${LEARN_USER}' ready"
}

step_clone() {
  local url="https://github.com/damessner/learn_.git"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    msg "Updating existing repository..."
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH" >/dev/null 2>&1
    git reset --hard "origin/$BRANCH" >/dev/null 2>&1
    cd - >/dev/null
    ok "Repository updated"
  else
    msg "Cloning repository..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --branch "$BRANCH" --depth 1 "$url" "$INSTALL_DIR" >/dev/null 2>&1
    ok "Repository cloned"
  fi
}

step_env() {
  msg "Configuring environment..."
  cd "$INSTALL_DIR"
  if [[ ! -f .env ]]; then
    local secret
    secret=$(openssl rand -hex 32)
    cat > .env <<EOF
# Database (SQLite — relative to project root)
DATABASE_URL="file:./dev.db"

# Required: 32+ character hex string for session encryption
SESSION_SECRET="${secret}"

# Set to true only if you have HTTPS behind a reverse proxy
# SECURE_COOKIE="true"

# --- Optional API Keys ---

# Google Gemini (AI writing coach, cloze generation)
# Get a free key: https://aistudio.google.com/apikey
# GEMINI_API_KEY="your_gemini_api_key"
# GEMINI_MODEL="gemini-3.5-flash"

# Pixabay (image search in worksheet creator)
# Get a free key: https://pixabay.com/api/docs/
# PIXABAY_API_KEY="your_pixabay_api_key"

# --- Aloys AI (Socratic Tutor) ---

# AI provider: "opencode" (default), "gemini", or "ollama"
# ALOYS_AI_PROVIDER="opencode"

# OpenCode GO (default provider)
# Get a key at https://opencode.go
# OPENCODE_API_KEY="your_opencode_api_key"
# OPENCODE_MODEL="deepseek-v4-flash"

# Ollama (local alternative)
# OLLAMA_API_BASE="http://localhost:11434"
# OLLAMA_MODEL="gemma2"
EOF
    mkdir -p content/exercises
  else
    note "Existing .env preserved"
  fi
  chown -R "$LEARN_USER":"$LEARN_USER" "$INSTALL_DIR"
  ok "Environment configured"
}

step_npm() {
  msg "Installing npm packages..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" npm install --no-audit --no-fund >/dev/null 2>&1
  ok "npm packages installed"

  msg "Generating Prisma client..."
  sudo -u "$LEARN_USER" npx prisma generate >/dev/null 2>&1
  ok "Prisma client generated"

  msg "Pushing database schema..."
  sudo -u "$LEARN_USER" npx prisma db push --accept-data-loss >/dev/null 2>&1
  ok "Database schema pushed"

  msg "Seeding database..."
  sudo -u "$LEARN_USER" npx prisma db seed >/dev/null 2>&1 || note "Seed skipped (data exists)"
  ok "Database seeded"
}

step_build() {
  msg "Building Next.js production bundle..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" npm run build >/dev/null 2>&1
  ok "Production build complete"
}

step_systemd() {
  msg "Setting up systemd service..."
  cat > /etc/systemd/system/learn.service <<UNIT
[Unit]
Description=Learn Platform
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=exec
User=${LEARN_USER}
Group=${LEARN_USER}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=${APP_PORT}
ExecStart=$(which npm) start
Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload >/dev/null 2>&1
  systemctl enable learn.service >/dev/null 2>&1
  ok "systemd service configured"
}

step_nginx() {
  [[ "${USE_NGINX:-false}" != "true" ]] && return

  msg "Installing nginx..."
  apt-get install -y -qq nginx >/dev/null 2>&1
  ok "nginx installed"

  local sname="${DOMAIN:-_}"

  msg "Writing nginx config..."
  cat > /etc/nginx/sites-available/learn <<NGX
upstream learn { server 127.0.0.1:${APP_PORT}; }

server {
    listen 80;
    listen [::]:80;
    server_name ${sname};

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://learn;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
        proxy_buffering off;
    }

    location /_next/static {
        proxy_pass http://learn;
        expires max;
        add_header Cache-Control "public, immutable";
    }

    location /public {
        alias ${INSTALL_DIR}/public;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGX
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/learn /etc/nginx/sites-enabled/
  ok "nginx config written"

  if [[ "${USE_SSL:-false}" == "true" && -n "${DOMAIN:-}" ]]; then
    msg "Installing Certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1
    systemctl start nginx >/dev/null 2>&1
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      --email "admin@${DOMAIN}" --redirect >/dev/null 2>&1 || \
      note "SSL setup failed. Fix later: certbot --nginx -d ${DOMAIN}"
    ok "SSL configured"
  fi
}

step_start() {
  msg "Starting learn.service..."
  systemctl start learn.service >/dev/null 2>&1
  ok "learn.service started"

  if [[ "${USE_NGINX:-false}" == "true" ]]; then
    systemctl start nginx >/dev/null 2>&1
    systemctl reload nginx >/dev/null 2>&1 || true
  fi
}

# ----- Summary -----
summary() {
  local ip
  ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)

  echo ""
  echo -e "${BOLD}${GN}============================================${CL}"
  echo -e "${BOLD}${GN}  ✅  Learn Platform Installed Successfully!${CL}"
  echo -e "${BOLD}${GN}============================================${CL}"
  echo ""

  if [[ "${USE_NGINX:-false}" == "true" && -n "${DOMAIN:-}" ]]; then
    local proto="http"
    [[ "${USE_SSL:-false}" == "true" ]] && proto="https"
    echo -e "  ${CHECK} URL:     ${DGN}${proto}://${DOMAIN}${CL}"
  elif [[ "${USE_NGINX:-false}" == "true" ]]; then
    echo -e "  ${CHECK} URL:     ${DGN}http://${ip}${CL}"
  else
    echo -e "  ${CHECK} URL:     ${DGN}http://${ip}:${APP_PORT}${CL}"
  fi

  echo -e "  ${INFO} Install: ${DGN}${INSTALL_DIR}${CL}"
  echo -e "  ${INFO} Config:  ${DGN}${INSTALL_DIR}/.env${CL}"
  echo -e "  ${INFO} Service: ${DGN}learn.service${CL}"
  echo ""
  note "Commands:"
  echo -e "    ${DGN}systemctl status learn${CL}"
  echo -e "    ${DGN}journalctl -u learn -f${CL}"
  echo ""
  note "Open the URL, register a TEACHER account, then create classrooms."
  echo -e "${GN}============================================${CL}"
  echo ""
}

# ----- Main -----
main() {
  header
  echo -e "\n${INFO}${BOLD}Learn Platform Installer for Debian 13${CL}\n"

  check_root
  check_debian
  check_arch
  check_ram
  check_disk

  get_config

  header
  echo -e "\n${INFO}${BOLD}Beginning installation...${CL}\n"

  step_prereqs
  step_node
  step_tts
  step_user
  step_clone
  step_env
  step_npm
  step_build
  step_systemd
  step_nginx
  step_start

  summary
}

main "$@"
