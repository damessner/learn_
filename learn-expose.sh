#!/usr/bin/env bash
# Learn Platform — Expose to Internet
# ====================================
# bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/damessner/learn_@main/learn-expose.sh)"
#
# Makes your Learn platform accessible from outside the local network.
# All methods are free, no credit card needed:
#
#   1) Tailscale           — Private VPN (students install Tailscale too)
#   2) Cloudflare Quick    — Public temp URL via trycloudflare.com (no account)
#   3) Cloudflare Tunnel   — Public permanent HTTPS (needs Cloudflare account + API token)
#   4) DuckDNS + Certbot   — Public HTTPS via port-forwarding + Let's Encrypt
#   5) Remove all access setup
#   6) Show info
#
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
WARN="${OFF}⚠️${OFF}"

# ----- Defaults -----
LEARN_DIR="/opt/learn"
APP_PORT="${APP_PORT:-3000}"
SKIP_PROMPTS=false
SELECTED_METHOD=""

for arg in "$@"; do
  [[ "$arg" == "-y" || "$arg" == "--yes" ]] && SKIP_PROMPTS=true
done

export DEBIAN_FRONTEND=noninteractive

# ----- Helpers -----
cleanup() { true; }
trap cleanup EXIT

err()  { echo -e "\n${CROSS}${RD}Error: $*${CL}\n" >&2; exit 1; }
msg()  { echo -ne "${OFF}${YW}${*}${CL}"; }
ok()   { echo -e "${BFR}${CHECK}${GN}${*}${CL}"; }
fail() { echo -e "${BFR}${CROSS}${RD}${*}${CL}"; }
note() { echo -e "${OFF}${INFO}${CL}${*}"; }
warn() { echo -e "${OFF}${WARN}${RD}${*}${CL}"; }

# ----- Header -----
header() {
  clear
  cat <<"EOF"

    __
   / /   ___  ____  _____
  / /   / _ \/ __ \/ ___/
 / /___/  __/ / / / /__
/_____/\___/_/ /_/\___/
               expose
===============================
  Learn Platform — Expose
  Public Access Setup
===============================
EOF
}

# ----- Prompt helpers (whiptail + fallback) -----
prompt_yesno() {
  local title="$1" msg="$2" rc answer
  [[ "$SKIP_PROMPTS" == "true" ]] && return 0

  if command -v whiptail &>/dev/null; then
    whiptail --backtitle "Learn Platform — Expose" \
      --title "$title" --yesno "$msg" 14 68 0</dev/tty 2>/dev/null
    rc=$?; [[ $rc -le 1 ]] && return $rc
  fi

  if exec <>/dev/tty 2>/dev/null; then
    echo ""; echo "=== $title ==="; echo -e "$msg"; echo -n "[Y/n] "
    read -r answer
    [[ "${answer,,}" != "n" && "${answer,,}" != "no" ]]; return $?
  fi

  return 0
}

prompt_input() {
  local title="$1" msg="$2" default="$3" rc val
  [[ "$SKIP_PROMPTS" == "true" ]] && { echo "$default"; return 0; }

  if command -v whiptail &>/dev/null; then
    val=$(whiptail --backtitle "Learn Platform — Expose" --title "$title" \
      --inputbox "$msg" 12 68 "$default" 0</dev/tty 3>&1 1>&2 2>&3)
    rc=$?; [[ $rc -le 1 ]] && { echo "$val"; return 0; }
  fi

  if exec <>/dev/tty 2>/dev/null; then
    echo ""; echo "=== $title ==="; echo -e "$msg"; echo -n "[$default] "
    read -r val; echo "${val:-$default}"; return 0
  fi

  echo "$default"
}

# ----- Pre-flight checks -----
check_root() {
  [[ "$EUID" -eq 0 ]] || err "Must run as root (use sudo)."
}

check_systemd() {
  command -v systemctl &>/dev/null || err "systemd not found. This script requires systemd."
}

check_learn() {
  if [[ ! -d "$LEARN_DIR" ]]; then
    err "Learn platform not found at ${LEARN_DIR}. Install it first via install.sh or learn-lxc.sh."
  fi
  if ! systemctl is-enabled learn.service &>/dev/null 2>&1; then
    warn "learn.service not found or not enabled. The access setup will still work,"
    warn "but you need a running web server on port ${APP_PORT}."
    if ! prompt_yesno "Continue?" "learn.service not detected. Continue anyway?"; then
      exit
    fi
  fi
}

check_learn_running() {
  if systemctl is-active --quiet learn.service 2>/dev/null; then
    return 0
  fi
  # Check if something is listening on APP_PORT
  if ss -tlnp 2>/dev/null | grep -q ":${APP_PORT} "; then
    return 0
  fi
  warn "Learn platform does not appear to be running on port ${APP_PORT}."
  warn "Start it first: systemctl start learn.service"
  if ! prompt_yesno "Continue?" "Proceed even though the app may not be running?"; then
    exit
  fi
}

detect_existing() {
  local existing=""
  if command -v tailscale &>/dev/null && systemctl is-active --quiet tailscaled 2>/dev/null; then
    existing+="tailscale "
  fi
  if command -v cloudflared &>/dev/null && systemctl is-active --quiet cloudflared* 2>/dev/null; then
    existing+="cloudflare "
  fi
  if systemctl is-active --quiet nginx 2>/dev/null; then
    existing+="nginx "
  fi
  echo "$existing"
}

# ----- Menu -----
show_menu() {
  local existing existing_str
  existing=$(detect_existing)
  existing_str=""
  [[ -n "$existing" ]] && existing_str="\n${WARN}Detected: ${existing}${CL}"

  local menu_msg="How do you want to expose your Learn platform?${existing_str}

  Access method                            Acccount?     Automation
 ───────────────────────────────────────────────────────────────────
  1) Tailscale (VPN, private)              No browser      ✨ Fully auto
  2) Cloudflare Quick Tunnel (temp URL)    No account      ✨ Fully auto
  3) Cloudflare Permanent Tunnel           Cloudflare       🔸 Paste token
  4) DuckDNS + Certbot                     DuckDNS          🔸 Paste token
  5) Remove all access setup
  6) Show info only

  2 = instant try, URL changes on restart.
  3 = permanent HTTPS, one-time token paste."

  local choice
  choice=$(prompt_input "Exposure Method" "$menu_msg" "3")

  case "$choice" in
    1|tailscale|ts)         SELECTED_METHOD="tailscale" ;;
    2|cloudflare-quick|cfq) SELECTED_METHOD="cloudflare-quick" ;;
    3|cloudflare|cf)         SELECTED_METHOD="cloudflare" ;;
    4|duckdns|certbot)       SELECTED_METHOD="duckdns" ;;
    5|remove|cleanup)        SELECTED_METHOD="remove" ;;
    6|info|help)             SELECTED_METHOD="info" ;;
    *)                       err "Invalid choice. Select 1-6." ;;
  esac
}

# ----- Tailscale -----
install_tailscale() {
  header
  echo -e "\n${INFO}${BOLD}Method: Tailscale (Private VPN)${CL}\n"

  if command -v tailscale &>/dev/null; then
    ok "Tailscale already installed ($(tailscale --version 2>/dev/null | head -1))"
  else
    msg "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
    ok "Tailscale installed"
  fi

  if systemctl is-active --quiet tailscaled; then
    ok "tailscaled already running"
  else
    msg "Starting tailscaled..."
    systemctl enable --now tailscaled
    ok "tailscaled started"
  fi

  # Check if already logged in
  local ts_status
  ts_status=$(tailscale status 2>/dev/null | head -1) || true
  if echo "$ts_status" | grep -qE "Logged in|Active"; then
    ok "Already logged into Tailscale"
  else
    echo ""
    note "┌────────────────────────────────────────────────────────────┐"
    note "│ Opening Tailscale login...                                 │"
    note "│                                                            │"
    note "│ • A URL will be displayed below.                           │"
    note "│ • Open it in a browser on ANY device (phone, laptop...).   │"
    note "│ • Log in with your Google/Microsoft/GitHub/email account.  │"
    note "│ • That's it — no credit card, no domain needed.            │"
    note "└────────────────────────────────────────────────────────────┘"
    echo ""
    msg "Running tailscale up (follow the login link)..."
    # tailscale up will print the URL and block until authenticated
    tailscale up --accept-routes
    ok "Tailscale login complete"
  fi

  # Get Tailscale IP / magic DNS name
  local ts_ip ts_host
  ts_ip=$(tailscale ip -4 2>/dev/null) || ts_ip="<tailscale-ip>"
  ts_host=$(tailscale status 2>/dev/null | grep "$(hostname)" | awk '{print $2}' | head -1) || ts_host="<machine-name>"

  # Store the URL for the summary
  TAILSCALE_IP="$ts_ip"
  TAILSCALE_HOST="$ts_host"
}

# ----- Cloudflare Tunnel (helpers) -----
# Shared: install cloudflared binary
install_cloudflared_binary() {
  local arch bin
  arch=$(dpkg --print-architecture)
  bin="/usr/local/bin/cloudflared"

  if command -v cloudflared &>/dev/null; then
    ok "cloudflared already installed ($(cloudflared --version 2>/dev/null | head -1))"
    return
  fi

  msg "Downloading cloudflared (${arch})..."
  case "$arch" in
    amd64)  curl -fsSL -o "$bin" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" ;;
    arm64)  curl -fsSL -o "$bin" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64" ;;
    armhf)  curl -fsSL -o "$bin" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm" ;;
    *)      err "Unsupported architecture: ${arch}. Use amd64 or arm64." ;;
  esac
  chmod +x "$bin"
  ok "cloudflared downloaded"
}

# ----- Cloudflare Quick Tunnel (no account needed) -----
install_cloudflare_quick() {
  header
  echo -e "\n${INFO}${BOLD}Method: Cloudflare Quick Tunnel (temp URL, no account)${CL}\n"

  install_cloudflared_binary

  if systemctl is-active --quiet cloudflared-quick 2>/dev/null; then
    ok "Quick tunnel already running"
    local existing_url
    existing_url=$(systemctl show cloudflared-quick -p ExecStart 2>/dev/null | grep -oP 'https://[^\s]+' | head -1 || true)
    if [[ -n "$existing_url" ]]; then
      CLOUDFLARE_QUICK_URL="$existing_url"
    fi
    return
  fi

  # Create a systemd service for the quick tunnel
  # cloudflared tunnel --url picks a random trycloudflare.com URL each start
  cat > /etc/systemd/system/cloudflared-quick.service <<UNIT
[Unit]
Description=Cloudflare Quick Tunnel (trycloudflare.com)
After=network-online.target
Wants=network-online.target

[Service]
Type=exec
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:${APP_PORT}
Restart=always
RestartSec=5
User=nobody

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable --now cloudflared-quick.service

  # Wait for the URL to appear in the logs
  msg "Waiting for tunnel URL..."
  local url=""
  for i in $(seq 1 15); do
    sleep 1
    url=$(journalctl -u cloudflared-quick --since "30 seconds ago" --no-pager 2>/dev/null | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
    [[ -n "$url" ]] && break
  done

  if [[ -n "$url" ]]; then
    CLOUDFLARE_QUICK_URL="$url"
    ok "Tunnel ready"
  else
    warn "Could not detect tunnel URL automatically."
    note "Check: journalctl -u cloudflared-quick -n 20 --no-pager"
    CLOUDFLARE_QUICK_URL="<check journalctl -u cloudflared-quick>"
  fi

  # Enable secure cookies — Cloudflare Quick Tunnel always delivers HTTPS to clients
  if [[ -f "${LEARN_DIR}/.env" ]]; then
    sed -i 's|^# SECURE_COOKIE=.*|SECURE_COOKIE="true"|' "${LEARN_DIR}/.env" 2>/dev/null || true
    if systemctl is-active --quiet learn.service 2>/dev/null; then
      systemctl restart learn.service 2>/dev/null || true
    fi
    ok "SECURE_COOKIE enabled (Cloudflare provides HTTPS)"
  fi
}

# ----- Cloudflare Permanent Tunnel (needs API token) -----
install_cloudflare() {
  header
  echo -e "\n${INFO}${BOLD}Method: Cloudflare Permanent Tunnel (HTTPS, needs API token)${CL}\n"

  install_cloudflared_binary

  # ── Authenticate via API token (no browser needed) ──
  local cf_token=""

  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    cf_token="$CLOUDFLARE_API_TOKEN"
    ok "Using CLOUDFLARE_API_TOKEN from environment"
  elif [[ -f ~/.cloudflared/api-token ]]; then
    cf_token=$(cat ~/.cloudflared/api-token)
    ok "Using saved Cloudflare API token"
  fi

  if [[ -z "$cf_token" ]]; then
    echo ""
    note "┌────────────────────────────────────────────────────────────┐"
    note "│ Cloudflare API Token                                      │"
    note "│                                                            │"
    note "│ This is the ONE manual step (do it on any device):         │"
    note "│                                                            │"
    note "│ 1. Go to: https://dash.cloudflare.com/profile/api-tokens   │"
    note "│ 2. Click 'Create Token'                                   │"
    note "│ 3. Use 'Edit Cloudflare Workers' template (simplest)       │"
    note "│    OR create custom with: Tunnel:Edit, DNS:Edit, Zone:Read │"
    note "│ 4. Copy the generated token                                │"
    note "│ 5. Paste it below                                          │"
    note "│                                                            │"
    note "│ The token is saved locally & reused next time.             │"
    note "└────────────────────────────────────────────────────────────┘"
    echo ""
    cf_token=$(prompt_input "API Token" "Paste your Cloudflare API token:" "")
    [[ -z "$cf_token" ]] && err "Token required. Run the script again when you have one."

    # Save for next run
    mkdir -p ~/.cloudflared
    echo "$cf_token" > ~/.cloudflared/api-token
    chmod 600 ~/.cloudflared/api-token
    ok "Token saved to ~/.cloudflared/api-token"
  fi

  # ── Create tunnel (non-interactive with API token) ──
  local tunnel_name="learn"
  local tunnel_id

  # Check existing tunnels via API
  tunnel_id=$(CLOUDFLARE_API_TOKEN="$cf_token" cloudflared tunnel list 2>/dev/null | awk -v name="$tunnel_name" '$2 == name {print $1}' | head -1)

  if [[ -z "$tunnel_id" ]]; then
    msg "Creating tunnel '${tunnel_name}'..."
    local create_out
    create_out=$(CLOUDFLARE_API_TOKEN="$cf_token" cloudflared tunnel create "$tunnel_name" 2>&1)
    tunnel_id=$(echo "$create_out" | grep -oP '(?<=ID: )\S+')
    if [[ -z "$tunnel_id" ]]; then
      err "Tunnel creation failed. Is your API token valid?\n${create_out}"
    fi
    ok "Tunnel '${tunnel_name}' created (${tunnel_id})"
  else
    ok "Tunnel '${tunnel_name}' already exists (${tunnel_id})"
  fi

  # ── Optionally set up DNS route ──
  local use_dns=false cf_domain=""
  if prompt_yesno "DNS Route" \
    "Route a domain through this tunnel?

This makes your tunnel accessible via your own domain (e.g., learn.example.com).
Your domain's DNS must be managed by Cloudflare (free plan works).

Skip if you just want the tunnel UUID URL or a trycloudflare.com quick tunnel."; then
    use_dns=true
    cf_domain=$(prompt_input "Domain" "Your domain (e.g., learn.example.com)
Must be on Cloudflare DNS." "")
    if [[ -n "$cf_domain" ]]; then
      msg "Creating DNS route for ${cf_domain}..."
      CLOUDFLARE_API_TOKEN="$cf_token" cloudflared tunnel route dns "$tunnel_name" "$cf_domain" 2>&1 || \
        warn "DNS route failed. Set it manually in Cloudflare dashboard."
      ok "DNS route configured"
    fi
  fi

  # ── Write config ──
  local cf_home="${HOME}/.cloudflared"
  local credentials_file
  credentials_file=$(ls -t "${cf_home}"/*.json 2>/dev/null | head -1)
  if [[ -z "$credentials_file" ]]; then
    err "No credentials JSON found in ${cf_home}. Run 'cloudflared tunnel create' manually."
  fi

  mkdir -p "$cf_home"
  local config_file="${cf_home}/config.yml"

  if [[ ! -f "$config_file" ]]; then
    msg "Writing tunnel config..."
    cat > "$config_file" <<YML
tunnel: ${tunnel_name}
credentials-file: ${credentials_file}

ingress:
  - hostname: "${cf_domain}"
    service: http://localhost:${APP_PORT}
  - hostname: ""
    service: http://localhost:${APP_PORT}
YML
    ok "Tunnel config written"
  fi

  # ── systemd service ──
  msg "Installing cloudflared systemd service..."
  CLOUDFLARE_API_TOKEN="$cf_token" cloudflared install 2>/dev/null || true
  ok "cloudflared systemd service installed"

  # ── Restart ──
  msg "Starting cloudflared tunnel..."
  systemctl restart cloudflared
  ok "cloudflared restarted"

  # ── Get URL ──
  local tunnel_url=""
  if [[ -n "$cf_domain" ]]; then
    tunnel_url="https://${cf_domain}"
  else
    tunnel_uuid=$(cloudflared tunnel info "$tunnel_name" 2>/dev/null | grep -oP '[a-f0-9-]{36}' | head -1)
    if [[ -n "$tunnel_uuid" ]]; then
      tunnel_url="https://${tunnel_uuid}.cfargotunnel.com"
    fi
  fi
  CLOUDFLARE_URL="${tunnel_url:-<check: cloudflared tunnel info ${tunnel_name}>}"

  # ── Enable secure cookies ──
  if [[ -f "${LEARN_DIR}/.env" ]]; then
    sed -i 's|^# SECURE_COOKIE=.*|SECURE_COOKIE="true"|' "${LEARN_DIR}/.env" 2>/dev/null || true
    if systemctl is-active --quiet learn.service 2>/dev/null; then
      systemctl restart learn.service 2>/dev/null || true
    fi
  fi
}

# ----- DuckDNS + Certbot -----
install_duckdns() {
  header
  echo -e "\n${INFO}${BOLD}Method: DuckDNS + Certbot (Public HTTPS)${CL}\n"

  note "You need:"
  note "  • A DuckDNS account (free, no CC — https://duckdns.org)"
  note "  • A domain like 'meine-schule.duckdns.org'"
  note "  • Port-forwarding on your router: port 80+443 → LXC IP"
  echo ""

  local domain token
  domain=$(prompt_input "DuckDNS Domain" \
    "Your DuckDNS subdomain (without .duckdns.org)
Example: meine-schule" "")
  [[ -z "$domain" ]] && err "Domain is required."
  # Strip .duckdns.org if user included it
  domain="${domain%.duckdns.org}"
  domain="${domain%.duckdns.org}"

  token=$(prompt_input "DuckDNS Token" \
    "Your DuckDNS token (find it at duckdns.org under 'domains')
Looks like: a1b2c3d4-e5f6-7890-abcd-ef1234567890" "")
  [[ -z "$token" ]] && err "Token is required."

  local fqdn="${domain}.duckdns.org"

  # Install DuckDNS update script
  msg "Installing DuckDNS updater..."
  mkdir -p /usr/local/bin
  cat > /usr/local/bin/duckdns-update.sh <<SCRIPT
#!/usr/bin/env bash
# DuckDNS IP updater — installed by learn-expose.sh
set -e
curl -fsSL "https://www.duckdns.org/update?domains=${domain}&token=${token}&ip=" -o /tmp/duckdns-result 2>/dev/null || true
SCRIPT
  chmod +x /usr/local/bin/duckdns-update.sh
  ok "DuckDNS updater installed"

  # Run once to register IP
  msg "Registering IP with DuckDNS..."
  /usr/local/bin/duckdns-update.sh
  ok "IP registered"

  # Install systemd timer (runs every 5 minutes)
  cat > /etc/systemd/system/duckdns-update.service <<UNIT
[Unit]
Description=Update DuckDNS IP
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/duckdns-update.sh
UNIT

  cat > /etc/systemd/system/duckdns-update.timer <<UNIT
[Unit]
Description=Update DuckDNS IP every 5 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT

  systemctl daemon-reload
  systemctl enable --now duckdns-update.timer
  ok "DuckDNS timer enabled (updates IP every 5 minutes)"

  # Install nginx if not present
  local nginx_was_installed=false
  if ! command -v nginx &>/dev/null; then
    msg "Installing nginx..."
    apt-get update -qq 2>/dev/null
    apt-get install -y -qq nginx
    ok "nginx installed"
    nginx_was_installed=true
  else
    ok "nginx already installed"
  fi

  # Write nginx config
  msg "Configuring nginx reverse proxy..."
  cat > /etc/nginx/sites-available/learn <<NGX
upstream learn { server 127.0.0.1:${APP_PORT}; }

server {
    listen 80;
    listen [::]:80;
    server_name ${fqdn};

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
        alias ${LEARN_DIR}/public;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGX

  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/learn /etc/nginx/sites-enabled/
  systemctl enable nginx
  systemctl restart nginx
  ok "nginx configured for ${fqdn}"

  # Enable HTTPS via SECURE_COOKIE in .env
  if [[ -f "${LEARN_DIR}/.env" ]]; then
    sed -i 's|^# SECURE_COOKIE=.*|SECURE_COOKIE="true"|' "${LEARN_DIR}/.env" 2>/dev/null || true
    note "Updated SECURE_COOKIE=true in ${LEARN_DIR}/.env"
  fi

  # Certbot for HTTPS
  if prompt_yesno "SSL Certificate" \
    "Set up Let's Encrypt HTTPS certificate for ${fqdn}?

Requires port 80 to be publicly reachable (port-forwarding active)."; then
    msg "Installing Certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx
    ok "Certbot installed"

    msg "Requesting Let's Encrypt certificate..."
    certbot --nginx -d "$fqdn" --non-interactive --agree-tos \
      --email "admin@${fqdn}" --redirect || \
      warn "SSL setup failed. Run later: certbot --nginx -d ${fqdn}"

    if grep -q "listen 443 ssl" /etc/nginx/sites-available/learn 2>/dev/null; then
      ok "HTTPS configured"
    fi

    # Set up auto-renewal timer (Certbot usually does this, but ensure it's active)
    systemctl enable --now certbot.timer 2>/dev/null || true
    note "Certbot auto-renewal configured"
  fi

  DUCKDNS_FQDN="$fqdn"
}

# ----- Remove / Cleanup -----
remove_access() {
  header
  echo -e "\n${INFO}${BOLD}Remove existing access setup${CL}\n"

  local removed=false

  # Tailscale
  if command -v tailscale &>/dev/null; then
    if prompt_yesno "Remove Tailscale?" "Uninstall Tailscale and stop the service?"; then
      msg "Removing Tailscale..."
      systemctl stop tailscaled 2>/dev/null || true
      systemctl disable tailscaled 2>/dev/null || true
      apt-get remove -y tailscale 2>/dev/null || true
      rm -f /usr/bin/tailscale /usr/sbin/tailscaled
      ok "Tailscale removed"
      removed=true
    fi
  fi

  # Cloudflare Quick Tunnel
  if systemctl is-enabled cloudflared-quick &>/dev/null 2>&1; then
    if prompt_yesno "Remove Cloudflare Quick Tunnel?" "Stop the quick tunnel service?"; then
      msg "Removing Cloudflare Quick Tunnel..."
      systemctl stop cloudflared-quick 2>/dev/null || true
      systemctl disable cloudflared-quick 2>/dev/null || true
      rm -f /etc/systemd/system/cloudflared-quick.service
      systemctl daemon-reload
      ok "Cloudflare Quick Tunnel removed"
      removed=true
    fi
  fi

  # Cloudflare Tunnel (permanent)
  if command -v cloudflared &>/dev/null; then
    if prompt_yesno "Remove Cloudflare Tunnel?" "Uninstall cloudflared and remove tunnel config?"; then
      msg "Removing Cloudflare Tunnel..."
      local tunnel_name="learn"
      cloudflared tunnel delete "$tunnel_name" 2>/dev/null || true
      systemctl stop cloudflared 2>/dev/null || true
      cloudflared uninstall 2>/dev/null || true
      rm -f /usr/local/bin/cloudflared
      rm -rf ~/.cloudflared
      ok "Cloudflare Tunnel removed"
      removed=true
    fi
  fi

  # DuckDNS
  if [[ -f /usr/local/bin/duckdns-update.sh ]]; then
    if prompt_yesno "Remove DuckDNS?" "Stop DuckDNS updater and remove configuration?"; then
      msg "Removing DuckDNS..."
      systemctl stop duckdns-update.timer duckdns-update.service 2>/dev/null || true
      systemctl disable duckdns-update.timer duckdns-update.service 2>/dev/null || true
      rm -f /etc/systemd/system/duckdns-update.*
      rm -f /usr/local/bin/duckdns-update.sh
      systemctl daemon-reload
      ok "DuckDNS removed"
      removed=true
    fi
  fi

  # nginx (only if it was installed by this script — detect via sites-available/learn)
  if [[ -f /etc/nginx/sites-available/learn ]]; then
    if prompt_yesno "Remove nginx config?" "Remove the Learn nginx site config (keep nginx installed)?"; then
      msg "Removing nginx config..."
      rm -f /etc/nginx/sites-enabled/learn
      rm -f /etc/nginx/sites-available/learn
      systemctl reload nginx 2>/dev/null || true
      ok "nginx config removed"
      removed=true
    fi
  fi

  if [[ "$removed" == false ]]; then
    note "Nothing to remove."
  fi
}

# ----- Info only -----
show_info() {
  header
  echo -e "\n${INFO}${BOLD}Manual Access Methods — Reference${CL}\n"

  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${CL}"
  echo -e "${BOLD}│ 1. Tailscale (VPN)                                      │${CL}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${CL}"
  echo ""
  echo "  # Install & login"
  echo "  curl -fsSL https://tailscale.com/install.sh | sh"
  echo "  tailscale up"
  echo ""
  echo "  # Access at: http://<machine-name>:3000 (within Tailscale network)"
  echo "  # Students install Tailscale too → they see your machine."
  echo ""

  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${CL}"
  echo -e "${BOLD}│ 2. Cloudflare Tunnel (Public HTTPS)                     │${CL}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${CL}"
  echo ""
  echo "  # Install cloudflared"
  echo "  curl -fsSL -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
  echo "  chmod +x /usr/local/bin/cloudflared"
  echo ""
  echo "  # Login (opens browser URL)"
  echo "  cloudflared tunnel login"
  echo ""
  echo "  # Create tunnel"
  echo "  cloudflared tunnel create learn"
  echo "  cloudflared tunnel route dns learn my-school.trycloudflare.com"
  echo ""

  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${CL}"
  echo -e "${BOLD}│ 3. DuckDNS + Certbot (Public HTTPS via port-forward)    │${CL}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${CL}"
  echo ""
  echo "  1. Sign up at https://duckdns.org (free, no credit card)"
  echo "  2. Create a domain → get your token"
  echo "  3. Run this script and choose option 3 :)"
  echo "  4. Port-forward: external 80+443 → LXC-IP:80+443"
  echo ""

  echo -e "${BOLD}┌─────────────────────────────────────────────────────────┐${CL}"
  echo -e "${BOLD}│ Recommendation                                          │${CL}"
  echo -e "${BOLD}└─────────────────────────────────────────────────────────┘${CL}"
  echo ""
  echo "  🏫 School setting (students have school laptops):"
  echo "     → Tailscale. Install once on each device, done."
  echo ""
  echo "  🌐 Public access (students use any device, no install):"
  echo "     → Cloudflare Tunnel. No port-forwarding needed."
  echo ""
  echo "  🏠 Home server (you control the router):"
  echo "     → DuckDNS + Certbot. Full control."
  echo ""
}

# ----- Summary -----
summary() {
  echo ""
  echo -e "${BOLD}${GN}============================================${CL}"
  echo -e "${BOLD}${GN}  ✅  Learn Platform — Public Access Setup${CL}"
  echo -e "${BOLD}${GN}============================================${CL}"
  echo ""

  case "$SELECTED_METHOD" in
    tailscale)
      echo -e "  ${CHECK} Method:   ${DGN}Tailscale (Private VPN)${CL}"
      echo -e "  ${CHECK} Machine:  ${DGN}${TAILSCALE_HOST:-<hostname>}${CL}"
      echo -e "  ${CHECK} IP:       ${DGN}${TAILSCALE_IP:-<ip>}${CL}"
      echo ""
      echo -e "  ${INFO} Access URL: ${DGN}http://${TAILSCALE_IP}:${APP_PORT}${CL}"
      echo ""
      note "Every user needs Tailscale installed on their device:"
      echo -e "    ${DGN}https://tailscale.com/download${CL}"
      echo ""
      note "Tailscale admin console (manage users):"
      echo -e "    ${DGN}https://login.tailscale.com${CL}"
      ;;

    cloudflare-quick)
      echo -e "  ${CHECK} Method:   ${DGN}Cloudflare Quick Tunnel (temp URL)${CL}"
      echo ""
      echo -e "  ${INFO} Access URL: ${DGN}${CLOUDFLARE_QUICK_URL:-<starting up...>}${CL}"
      echo ""
      warn "⚠️  This URL changes on restart! For a permanent URL, use option 3."
      note "Check URL after reboot: journalctl -u cloudflared-quick | grep trycloudflare"
      note "Port ${APP_PORT} is only reachable via the tunnel. To also block direct LAN"
      note "access to port ${APP_PORT}, add a firewall rule dropping tcp dport ${APP_PORT} from"
      note "non-loopback interfaces (Proxmox UI firewall or nftables inside the container)."
      ;;

    cloudflare)
      echo -e "  ${CHECK} Method:   ${DGN}Cloudflare Permanent Tunnel (HTTPS)${CL}"
      echo ""
      if [[ -n "${CLOUDFLARE_URL:-}" ]]; then
        echo -e "  ${INFO} Access URL: ${DGN}${CLOUDFLARE_URL}${CL}"
      else
        note "Get your tunnel URL:"
        echo -e "    ${DGN}cloudflared tunnel info learn${CL}"
      fi
      echo ""
      note "Cloudflare dashboard:"
      echo -e "    ${DGN}https://dash.cloudflare.com${CL}"
      ;;

    duckdns)
      echo -e "  ${CHECK} Method:   ${DGN}DuckDNS + Certbot (Public HTTPS)${CL}"
      if [[ -n "${DUCKDNS_FQDN:-}" ]]; then
        local proto="http"
        grep -q "listen 443" /etc/nginx/sites-available/learn 2>/dev/null && proto="https"
        echo -e "  ${CHECK} Domain:   ${DGN}${DUCKDNS_FQDN}${CL}"
        echo ""
        echo -e "  ${INFO} Access URL: ${DGN}${proto}://${DUCKDNS_FQDN}${CL}"
        echo ""
        if [[ "$proto" == "http" ]]; then
          warn "⚠️  Port 80 must be forwarded on your router → ${DUCKDNS_FQDN}"
          warn "   Then run: certbot --nginx -d ${DUCKDNS_FQDN}"
        else
          note "Let's Encrypt auto-renewal active."
        fi
      fi
      ;;
  esac

  echo ""
  note "Manage learn platform:"
  echo -e "    ${DGN}systemctl status learn${CL}"
  echo -e "    ${DGN}journalctl -u learn -f${CL}"
  echo ""

  if [[ "$SELECTED_METHOD" != "remove" && "$SELECTED_METHOD" != "info" ]]; then
    note "Run this script again to change or remove the access method."
  fi

  echo -e "${GN}============================================${CL}"
  echo ""
}

# ----- Main -----
main() {
  header
  echo -e "\n${INFO}${BOLD}Learn Platform — Public Access Setup${CL}\n"
  echo -e "${OFF}Makes your Learn platform accessible from outside your local network."
  echo -e "${OFF}Three methods — all free, no credit card needed.\n"

  check_root
  check_systemd
  check_learn
  check_learn_running

  show_menu

  case "$SELECTED_METHOD" in
    tailscale)
      install_tailscale
      ;;
    cloudflare-quick)
      install_cloudflare_quick
      ;;
    cloudflare)
      install_cloudflare
      ;;
    duckdns)
      install_duckdns
      ;;
    remove)
      remove_access
      ;;
    info)
      show_info
      return
      ;;
  esac

  summary
}

main "$@"
