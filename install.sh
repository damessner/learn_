#!/usr/bin/env bash

# Learn Platform Installer
# ========================
# curl -fsSL https://raw.githubusercontent.com/damessner/learn_/main/install.sh | bash
#
# Non-interactive (no prompts, all defaults):
# curl -fsSL https://raw.githubusercontent.com/damessner/learn_/main/install.sh | bash -s -- -y
#
# Installs the Learn educational platform on Debian 13 (Trixie).
# Includes: Node.js, Python TTS engine, systemd service, optional nginx + SSL.
#
# License: MIT | https://github.com/damessner/learn_/raw/main/LICENSE

set -e
trap 'error_handler $LINENO "$BASH_COMMAND"' ERR
trap cleanup EXIT
trap 'echo -e "\n${CROSS}${RD}Installation interrupted${CL}\n"; exit 130' INT
trap 'echo -e "\n${CROSS}${RD}Installation terminated${CL}\n"; exit 143' TERM

# ==============================================================================
# COLOR / ICON VARIABLES
# ==============================================================================
YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
BGN=$(echo "\033[4;92m")
GN=$(echo "\033[1;92m")
DGN=$(echo "\033[32m")
CL=$(echo "\033[m")
BOLD=$(echo "\033[1m")
BFR="\\r\\033[K"
HOLD=" "
TAB="  "

CM="${TAB}✔️${TAB}${CL}"
CROSS="${TAB}✖️${TAB}${CL}"
INFO="${TAB}💡${TAB}${CL}"
GEAR="${TAB}⚙️${TAB}${CL}"
OK="${TAB}✅${TAB}${CL}"

# ==============================================================================
# CONFIGURATION (user-overridable via environment variables)
# ==============================================================================
INSTALL_DIR="${INSTALL_DIR:-/opt/learn}"
REPO_URL="${REPO_URL:-https://github.com/damessner/learn_.git}"
BRANCH="${BRANCH:-main}"
APP_PORT="${APP_PORT:-3000}"
LEARN_USER="${LEARN_USER:-learn}"
LEARN_GROUP="${LEARN_GROUP:-learn}"
NODE_MAJOR="${NODE_MAJOR:-22}"
# For private repos: pass GITHUB_TOKEN env var to authenticate curl + git clone
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# Non-interactive mode (skip whiptail, use defaults)
SKIP_PROMPTS="${SKIP_PROMPTS:-false}"
# Parse --yes / -y flag
for arg in "$@"; do
  case "$arg" in
    -y|--yes) SKIP_PROMPTS="true" ;;
  esac
done

TEMP_DIR=$(mktemp -d)
export DEBIAN_FRONTEND=noninteractive

# ==============================================================================
# ASCII HEADER
# ==============================================================================
function header_info {
  clear
  cat <<"EOF"

    __                   
   / /   ___  ____  _____
  / /   / _ \/ __ \/ ___/
 / /___/  __/ / / / /__  
/_____/\___/_/ /_/\___/  
                   v0.1.0
===================================
  Learn Platform Installer
  Debian 13 (Trixie)
===================================
EOF
}

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================
function msg_info() {
  local msg="$1"
  echo -ne "${TAB}${YW}${HOLD}${msg}${HOLD}"
}

function msg_ok() {
  local msg="$1"
  echo -e "${BFR}${CM}${GN}${msg}${CL}"
}

function msg_error() {
  local msg="$1"
  echo -e "${BFR}${CROSS}${RD}${msg}${CL}"
}

function notify() {
  local msg="$1"
  echo -e "${TAB}${INFO}${CL}${msg}"
}

function exit_script() {
  header_info
  echo -e "\n${CROSS}${RD}Installation cancelled by user${CL}\n"
  exit
}

function error_handler() {
  local exit_code="$?"
  local line_number="$1"
  local command="$2"
  echo -e "\n${CROSS}${RD}Error on line ${line_number}: exit code ${exit_code}${CL}"
  echo -e "${INFO}Command: ${YW}${command}${CL}\n"
}

function cleanup() {
  rm -rf "$TEMP_DIR" 2>/dev/null || true
}

# ==============================================================================
# PREREQUISITE CHECKS
# ==============================================================================
function check_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    clear
    msg_error "This script must be run as root (use sudo)."
    echo -e "\nExiting..."
    exit 1
  fi
}

function check_debian() {
  if [ ! -f /etc/debian_version ]; then
    msg_error "This script only supports Debian-based systems."
    exit 1
  fi

  local DEBIAN_VERSION
  DEBIAN_VERSION=$(cat /etc/debian_version | cut -d'.' -f1)
  if [[ "$DEBIAN_VERSION" != "13" ]]; then
    msg_error "This script is designed for Debian 13 (Trixie)."
    msg_error "Detected version: $(cat /etc/debian_version)"
    exit 1
  fi
}

function arch_check() {
  local ARCH
  ARCH=$(dpkg --print-architecture 2>/dev/null)
  if [[ "$ARCH" != "amd64" ]]; then
    msg_error "This script only supports amd64 architecture."
    msg_error "Detected: ${ARCH:-unknown}"
    exit 1
  fi
}

function check_system() {
  # Check minimum RAM (2GB recommended for build)
  local TOTAL_RAM_MB
  TOTAL_RAM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
  if [[ "$TOTAL_RAM_MB" -lt 1024 ]]; then
    notify "Warning: Less than 1GB RAM detected (${TOTAL_RAM_MB}MB). Build may fail."
    if (whiptail --backtitle "Learn Platform Installer" --title "LOW MEMORY" \
      --yesno "Your system has less than 1GB RAM (${TOTAL_RAM_MB}MB).\n\nThe Next.js production build may fail or be extremely slow.\n\nDo you want to continue anyway?" 12 60); then
      :
    else
      exit_script
    fi
  fi

  # Check disk space (minimum 2GB free)
  local FREE_KB
  FREE_KB=$(df "$(dirname "$INSTALL_DIR")" --output=avail 2>/dev/null | tail -1)
  if [[ -n "$FREE_KB" && "$FREE_KB" -lt 2097152 ]]; then
    msg_error "Insufficient disk space. At least 2GB free required."
    exit 1
  fi
}

# ==============================================================================
# INTERACTIVE INSTALL FLOW (whiptail)
# ==============================================================================
function prompt_yesno() {
  local title="$1" msg="$2"
  if [[ "$SKIP_PROMPTS" == "true" ]]; then
    return 0
  fi
  whiptail --backtitle "Learn Platform Installer" --title "$title" --yesno "$msg" 0 0
}

function prompt_input() {
  local title="$1" msg="$2" default="$3"
  if [[ "$SKIP_PROMPTS" == "true" ]]; then
    echo "$default"
    return 0
  fi
  whiptail --backtitle "Learn Platform Installer" --title "$title" \
    --inputbox "$msg" 10 60 "$default" \
    --cancel-button Skip 3>&1 1>&2 2>&3
}

function check_whiptail() {
  if ! command -v whiptail &>/dev/null; then
    if [[ "$SKIP_PROMPTS" != "true" ]]; then
      echo -e "${INFO}whiptail not found — installing..."
      apt-get install -y -qq whiptail >/dev/null 2>&1 || {
        echo -e "${INFO}Could not install whiptail. Falling back to non-interactive mode."
        SKIP_PROMPTS="true"
      }
    fi
  fi
}

function guided_install() {
  # Ensure whiptail is available before we start
  check_whiptail

  header_info

  # -- Welcome prompt --
  if [[ "$SKIP_PROMPTS" != "true" ]]; then
    if ! (whiptail --backtitle "Learn Platform Installer" --title "Welcome" \
      --yesno "This will install the Learn Platform on your Debian 13 system.

Components to install:
  - Node.js ${NODE_MAJOR}.x + npm
  - Python 3 + TTS engine (kokoro-onnx)
  - Git clone from GitHub
  - Prisma database setup (SQLite)
  - systemd service (learn)
  - Optional: nginx reverse proxy + Let's Encrypt SSL

Target directory: ${INSTALL_DIR}

Proceed with installation?" 16 68); then
      exit_script
    fi
  fi

  # -- nginx prompt --
  local USE_NGINX=false
  if [[ "$SKIP_PROMPTS" == "true" ]]; then
    USE_NGINX=false
  elif (whiptail --backtitle "Learn Platform Installer" --title "REVERSE PROXY" \
    --yesno "Set up nginx as a reverse proxy?

This will proxy traffic from port 80/443 to the app on port ${APP_PORT}.
Recommended for production deployments." 11 60); then
    USE_NGINX=true
  fi

  # -- domain + SSL prompts --
  local DOMAIN=""
  local USE_SSL=false
  if [[ "$USE_NGINX" == true ]]; then
    if DOMAIN=$(whiptail --backtitle "Learn Platform Installer" --title "DOMAIN NAME" \
      --inputbox "Enter your domain name (e.g., learn.example.com)
Leave blank to use the server IP address." 10 60 \
      --cancel-button Skip 3>&1 1>&2 2>&3); then
      DOMAIN=$(echo "$DOMAIN" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
      if [[ -n "$DOMAIN" ]]; then
        if (whiptail --backtitle "Learn Platform Installer" --title "SSL CERTIFICATE" \
          --yesno "Set up Let's Encrypt SSL certificate for ${DOMAIN}?

Requires the domain to be publicly resolvable and port 80 to be reachable." 11 60); then
          USE_SSL=true
        fi
      fi
    fi
  fi

  # -- summary + confirm --
  if [[ "$SKIP_PROMPTS" != "true" ]]; then
    local SUMMARY="Installation Summary:\n\n"
    SUMMARY+="  - Install Directory: ${INSTALL_DIR}\n"
    SUMMARY+="  - App Port: ${APP_PORT}\n"
    SUMMARY+="  - Branch: ${BRANCH}\n"
    if [[ "$USE_NGINX" == true ]]; then
      SUMMARY+="  - nginx Reverse Proxy: Yes\n"
      if [[ -n "$DOMAIN" ]]; then
        SUMMARY+="  - Domain: ${DOMAIN}\n"
        if [[ "$USE_SSL" == true ]]; then
          SUMMARY+="  - Let's Encrypt SSL: Yes\n"
        else
          SUMMARY+="  - Let's Encrypt SSL: No\n"
        fi
      else
        SUMMARY+="  - Domain: (server IP)\n"
      fi
    else
      SUMMARY+="  - nginx Reverse Proxy: No\n"
      SUMMARY+="  - Access: http://<server-ip>:${APP_PORT}\n"
    fi

    if ! (whiptail --backtitle "Learn Platform Installer" --title "CONFIRM INSTALL" \
      --yesno "$SUMMARY\n\nProceed with these settings?" 16 68); then
      exit_script
    fi
  fi

  # Export for use in install steps
  export USE_NGINX DOMAIN USE_SSL
}

# ==============================================================================
# INSTALLATION STEPS
# ==============================================================================
function step_prerequisites() {
  msg_info "Updating package lists..."
  apt-get update -qq >/dev/null 2>&1
  msg_ok "Package lists updated"

  msg_info "Installing system prerequisites..."
  apt-get install -y -qq \
    curl wget git \
    python3 python3-pip python3-venv \
    build-essential pkg-config \
    libsystemd-dev \
    >/dev/null 2>&1
  msg_ok "System prerequisites installed"
}

function step_nodejs() {
  if command -v node &>/dev/null; then
    local NODE_VER
    NODE_VER=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VER" -ge 18 ]]; then
      msg_ok "Node.js $(node --version) already installed"
      return
    fi
  fi

  msg_info "Installing Node.js ${NODE_MAJOR}.x..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  msg_ok "Node.js $(node --version) installed"
}

function step_tts_deps() {
  msg_info "Installing Python TTS dependencies (kokoro-onnx)..."
  pip3 install --break-system-packages --quiet \
    kokoro-onnx numpy \
    >/dev/null 2>&1
  msg_ok "Python TTS dependencies installed"
}

function step_create_user() {
  msg_info "Creating system user '${LEARN_USER}'..."
  if ! id -u "$LEARN_USER" &>/dev/null; then
    groupadd -f "$LEARN_GROUP"
    useradd -r -g "$LEARN_GROUP" -d "$INSTALL_DIR" -s /usr/sbin/nologin "$LEARN_USER" 2>/dev/null || true
  fi
  msg_ok "System user '${LEARN_USER}' ready"
}

function step_clone_repo() {
  local CLONE_URL="$REPO_URL"

  # Inject token into clone URL for private repos
  if [[ -n "$GITHUB_TOKEN" ]]; then
    CLONE_URL="https://${GITHUB_TOKEN}@github.com/damessner/learn_.git"
  fi

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    msg_info "Repository already exists, updating..."
    cd "$INSTALL_DIR"
    # Update remote URL in case token changed
    git remote set-url origin "$CLONE_URL" >/dev/null 2>&1
    git fetch origin "$BRANCH" >/dev/null 2>&1
    git reset --hard "origin/$BRANCH" >/dev/null 2>&1
    cd - >/dev/null
    msg_ok "Repository updated"
  else
    msg_info "Cloning repository from GitHub..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --branch "$BRANCH" --depth 1 "$CLONE_URL" "$INSTALL_DIR" >/dev/null 2>&1
    msg_ok "Repository cloned to ${INSTALL_DIR}"
  fi
}

function step_env_file() {
  msg_info "Configuring environment (.env)..."
  cd "$INSTALL_DIR"

  if [[ ! -f .env ]]; then
    local SESSION_SECRET
    SESSION_SECRET=$(openssl rand -hex 32)

    cat > .env <<EOF
DATABASE_URL="file:./dev.db"
SESSION_SECRET="${SESSION_SECRET}"
EOF

    # Ensure exercise content directory exists (included in repo)
    mkdir -p content/exercises
  else
    notify "Existing .env found, preserving settings"
  fi

  # Ensure proper ownership
  chown -R "$LEARN_USER":"$LEARN_GROUP" "$INSTALL_DIR"
  msg_ok "Environment configured"
}

function step_npm_install() {
  msg_info "Installing npm dependencies..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" bash -c "npm install --no-audit --no-fund" >/dev/null 2>&1
  msg_ok "npm dependencies installed"

  msg_info "Generating Prisma client..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" npx prisma generate >/dev/null 2>&1
  msg_ok "Prisma client generated"

  msg_info "Pushing database schema..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" npx prisma db push --accept-data-loss >/dev/null 2>&1
  msg_ok "Database schema pushed"

  msg_info "Seeding database..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" npx prisma db seed >/dev/null 2>&1 || notify "Seed skipped (may already have data)"
  msg_ok "Database seeded"
}

function step_build() {
  msg_info "Building Next.js production bundle..."
  cd "$INSTALL_DIR"
  sudo -u "$LEARN_USER" npm run build >/dev/null 2>&1
  msg_ok "Next.js production build complete"
}

function step_systemd() {
  msg_info "Configuring systemd service..."

  cat > /etc/systemd/system/learn.service <<EOF
[Unit]
Description=Learn Platform
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=exec
User=${LEARN_USER}
Group=${LEARN_GROUP}
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
EOF

  systemctl daemon-reload >/dev/null 2>&1
  systemctl enable learn.service >/dev/null 2>&1
  msg_ok "systemd service 'learn' configured"
}

function step_nginx() {
  if [[ "$USE_NGINX" != "true" ]]; then
    return
  fi

  msg_info "Installing nginx..."
  apt-get install -y -qq nginx >/dev/null 2>&1
  msg_ok "nginx installed"

  local SERVER_NAME="_"

  if [[ -n "$DOMAIN" ]]; then
    SERVER_NAME="$DOMAIN"
  fi

  msg_info "Configuring nginx reverse proxy..."
  cat > /etc/nginx/sites-available/learn <<NGINX_CONF
upstream learn_backend {
    server 127.0.0.1:${APP_PORT};
}

server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};

    # HSTS (commented until SSL is active)
    # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Reverse proxy
    location / {
        proxy_pass http://learn_backend;
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

    # Static asset caching
    location /_next/static {
        proxy_pass http://learn_backend;
        expires max;
        add_header Cache-Control "public, immutable";
    }

    location /public {
        alias ${INSTALL_DIR}/public;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX_CONF

  if [[ -f /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi
  ln -sf /etc/nginx/sites-available/learn /etc/nginx/sites-enabled/
  msg_ok "nginx reverse proxy configured"

  # -- Let's Encrypt SSL --
  if [[ "$USE_SSL" == true && -n "$DOMAIN" ]]; then
    msg_info "Installing Certbot and setting up SSL..."
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1
    # First ensure nginx is running so certbot can validate
    systemctl start nginx >/dev/null 2>&1
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      --email "admin@${DOMAIN}" --redirect >/dev/null 2>&1 || {
      msg_error "SSL certificate setup failed. You can run later: certbot --nginx -d ${DOMAIN}"
    }
    msg_ok "SSL certificate configured for ${DOMAIN}"
  fi
}

function step_start_services() {
  msg_info "Starting Learn Platform service..."
  systemctl start learn.service >/dev/null 2>&1
  msg_ok "learn.service started"

  if [[ "$USE_NGINX" == "true" ]]; then
    msg_info "Starting nginx..."
    systemctl start nginx >/dev/null 2>&1
    systemctl reload nginx >/dev/null 2>&1
    msg_ok "nginx started"
  fi
}

# ==============================================================================
# SUMMARY OUTPUT
# ==============================================================================
function print_summary() {
  local IP
  IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)

  echo ""
  echo -e "${BOLD}${GN}============================================${CL}"
  echo -e "${BOLD}${GN}  ✅  Learn Platform Installed Successfully!${CL}"
  echo -e "${BOLD}${GN}============================================${CL}"
  echo ""

  if [[ "$USE_NGINX" == "true" && -n "$DOMAIN" ]]; then
    local PROTO="http"
    [[ "$USE_SSL" == "true" ]] && PROTO="https"
    echo -e "  ${OK} URL:       ${BGN}${PROTO}://${DOMAIN}${CL}"
  elif [[ "$USE_NGINX" == "true" ]]; then
    echo -e "  ${OK} URL:       ${BGN}http://${IP}${CL}"
  else
    echo -e "  ${OK} URL:       ${BGN}http://${IP}:${APP_PORT}${CL}"
  fi

  echo ""
  echo -e "  ${INFO} Install:   ${DGN}${INSTALL_DIR}${CL}"
  echo -e "  ${INFO} Config:    ${DGN}${INSTALL_DIR}/.env${CL}"
  echo -e "  ${INFO} Service:   ${DGN}learn.service${CL}"
  echo ""
  echo -e "  ${INFO} Commands:"
  echo -e "     Status:  ${DGN}systemctl status learn${CL}"
  echo -e "     Logs:    ${DGN}journalctl -u learn -f${CL}"
  echo -e "     Restart: ${DGN}systemctl restart learn${CL}"
  echo -e "     Stop:    ${DGN}systemctl stop learn${CL}"
  echo ""

  if [[ "$USE_SSL" != "true" && "$USE_NGINX" == "true" && -n "$DOMAIN" ]]; then
    echo -e "  ${INFO} To enable SSL later:"
    echo -e "     ${DGN}certbot --nginx -d ${DOMAIN}${CL}"
    echo ""
  fi

  echo -e "  ${INFO} First steps:"
  echo -e "     1. Open the URL in your browser"
  echo -e "     2. Register a ${BOLD}TEACHER${CL} account"
  echo -e "     3. Create classrooms and invite students"
  echo ""
  echo -e "  ${INFO} Documentation:"
  echo -e "     ${DGN}https://github.com/damessner/learn_${CL}"
  echo ""
  echo -e "${GN}============================================${CL}"
  echo ""
}

# ==============================================================================
# MAIN
# ==============================================================================
function main() {
  header_info
  echo -e "\n ${INFO}${BOLD}Learn Platform Installer for Debian 13${CL}\n"

  # -- Pre-flight checks --
  check_root
  check_debian
  arch_check
  check_system

  # -- Guided configuration --
  guided_install

  header_info
  echo -e "\n ${INFO}${BOLD}Beginning installation...${CL}\n"

  # -- Execute steps --
  step_prerequisites
  step_nodejs
  step_tts_deps
  step_create_user
  step_clone_repo
  step_env_file
  step_npm_install
  step_build
  step_systemd
  step_nginx
  step_start_services

  # -- Done --
  print_summary
}

main "$@"
