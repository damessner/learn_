#!/usr/bin/env bash
# Learn Platform — Proxmox LXC Creator
# ======================================
# bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/damessner/learn_@main/learn-lxc.sh)"
# bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/damessner/learn_@main/learn-lxc.sh)" -s -- -y
#
# Creates a Debian 13 LXC container on Proxmox VE with the Learn platform pre-installed.
# License: MIT

set -e

# ----- Colors / Icons (Proxmox Helper Script style) -----
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

# ----- Defaults -----
CT_ID=""
CT_HOSTNAME="learn"
CT_CORES=2
CT_RAM=2048
CT_DISK="8"
CT_BRIDGE="vmbr0"
CT_IP="dhcp"
CT_PASSWORD=""
CT_STORAGE=""
CT_DN=""
NSAPP="learn-lxc"
var_os="debian"
var_version="13"

SKIP_PROMPTS=false
for arg in "$@"; do
  [[ "$arg" == "-y" || "$arg" == "--yes" ]] && SKIP_PROMPTS=true
done

TEMP_DIR=$(mktemp -d)
export DEBIAN_FRONTEND=noninteractive

# ----- Cleanup -----
cleanup() { rm -rf "$TEMP_DIR" 2>/dev/null || true; }
trap cleanup EXIT

err()  { echo -e "\n${CROSS}${RD}Error: $*${CL}\n" >&2; exit 1; }
msg()  { echo -ne "${OFF}${YW}${*}${HOLD:- }"; }
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
                    LXC
===============================
  Learn Platform LXC Creator
  Proxmox VE · Debian 13
===============================
EOF
}

# ----- Prompt helpers (whiptail + plain fallback) -----
prompt_yesno() {
  local title="$1" msg="$2" rc answer
  [[ "$SKIP_PROMPTS" == "true" ]] && return 0
  if command -v whiptail &>/dev/null; then
    whiptail --backtitle "Learn Platform LXC Creator" \
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
    val=$(whiptail --backtitle "Learn Platform LXC Creator" \
      --title "$title" --inputbox "$msg" 10 60 "$default" 0</dev/tty 3>&1 1>&2 2>&3)
    rc=$?; [[ $rc -le 1 ]] && { echo "$val"; return 0; }
  fi
  if exec <>/dev/tty 2>/dev/null; then
    echo ""; echo "=== $title ==="; echo -e "$msg"; echo -n "[$default] "
    read -r val; echo "${val:-$default}"; return 0
  fi
  echo "$default"
}

# ----- Pre-flight -----
check_root()   { [[ "$EUID" -eq 0 ]] || err "Must run as root on Proxmox host."; }
check_proxmox() { command -v pveversion &>/dev/null || err "Not a Proxmox VE host (pveversion not found)."; }

check_arch() {
  [[ "$(dpkg --print-architecture)" == "amd64" ]] || err "Only amd64 supported."
}

detect_storage() {
  local storages
  storages=$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 {print $1}')
  if [[ -z "$storages" ]]; then
    # fallback: try content images
    storages=$(pvesm status -content images 2>/dev/null | awk 'NR>1 {print $1}')
  fi
  if [[ -z "$storages" ]]; then
    err "No suitable storage found for container. Check 'pvesm status -content rootdir'."
  fi
  # Pick first available
  CT_STORAGE=$(echo "$storages" | head -1)
  note "Using storage: ${DGN}${CT_STORAGE}${CL}"
}

get_next_id() {
  pvesh get /cluster/nextid 2>/dev/null || err "Cannot get next VM/CT ID."
}

# ----- Guided config -----
get_config() {
  header

  if ! prompt_yesno "Welcome" \
    "This will create a Debian 13 LXC container with the Learn platform pre-installed.

Container specs:
  - Debian 13 (Trixie) — systemd, amd64
  - Learn Platform (Next.js + SQLite + TTS)
  - systemd service (auto-start)
  - Optional: nginx reverse proxy

Proceed?"; then
    header; echo -e "\n${CROSS}${RD}Cancelled by user${CL}\n"; exit
  fi

  # CT ID
  local default_id
  default_id=$(get_next_id)
  local cid
  cid=$(prompt_input "Container ID" "Enter a numeric container ID" "$default_id")
  CT_ID=$(echo "$cid" | tr -cd '0-9')
  [[ -z "$CT_ID" ]] && CT_ID="$default_id"

  # Hostname (LXC requires valid DNS name, must not end with hyphen)
  local hn
  hn=$(prompt_input "Hostname" "Container hostname (letters, numbers, hyphens only)" "$CT_HOSTNAME")
  # Strip anything not alphanumeric or hyphen, then trim leading/trailing hyphens
  hn=$(printf '%s' "$hn" | tr -cs 'a-zA-Z0-9-' '-' | sed 's/^-//; s/-$//')
  if [[ -z "$hn" || "${#hn}" -gt 63 ]]; then
    hn="learn"
  fi
  CT_HOSTNAME="$hn"

  # Password
  local pw
  pw=$(prompt_input "Root Password" "Set root password for the container\nLeave blank to generate a random one" "")
  if [[ -z "$pw" ]]; then
    CT_PASSWORD=$(openssl rand -base64 24)
    note "Generated root password: ${DGN}${CT_PASSWORD}${CL}"
  else
    CT_PASSWORD="$pw"
  fi

  # Cores
  local cc
  cc=$(prompt_input "CPU Cores" "Number of CPU cores for the container" "$CT_CORES")
  CT_CORES=$(echo "$cc" | tr -cd '0-9')
  [[ -z "$CT_CORES" || "$CT_CORES" -lt 1 ]] && CT_CORES=2

  # RAM
  local ram
  ram=$(prompt_input "RAM (MiB)" "Memory in MiB (e.g., 1024, 2048)" "$CT_RAM")
  CT_RAM=$(echo "$ram" | tr -cd '0-9')
  [[ -z "$CT_RAM" || "$CT_RAM" -lt 512 ]] && CT_RAM=2048

  # Disk size
  local ds
  ds=$(prompt_input "Disk Size (GB)" "Root filesystem size in GB" "$CT_DISK")
  CT_DISK=$(echo "$ds" | tr -cd '0-9')
  [[ -z "$CT_DISK" || "$CT_DISK" -lt 2 ]] && CT_DISK=8

  # Bridge
  local br
  br=$(prompt_input "Network Bridge" "Proxmox bridge interface" "$CT_BRIDGE")
  CT_BRIDGE="${br:-vmbr0}"

  # Domain (optional nginx later)
  local d
  d=$(prompt_input "Domain Name (optional)" "Public domain for nginx reverse proxy\nLeave blank to skip nginx setup" "")
  CT_DN=$(echo "$d" | tr -d ' ' | tr '[:upper:]' '[:lower:]')

  # Summary
  local summary="Container Configuration:\n\n"
  summary+="  - CT ID:     ${CT_ID}\n"
  summary+="  - Hostname:  ${CT_HOSTNAME}\n"
  summary+="  - Cores:     ${CT_CORES}\n"
  summary+="  - RAM:       ${CT_RAM} MiB\n"
  summary+="  - Disk:      ${CT_DISK} GB\n"
  summary+="  - Bridge:    ${CT_BRIDGE}\n"
  summary+="  - Storage:   ${CT_STORAGE}\n"
  if [[ -n "$CT_DN" ]]; then summary+="  - Domain:    ${CT_DN}\n"; fi

  if ! prompt_yesno "Confirm" "$summary\nCreate this container?"; then
    header; echo -e "\n${CROSS}${RD}Cancelled by user${CL}\n"; exit
  fi
}

# Global: cached template path
CT_TPL_PATH=""

# ----- LXC template -----
download_template() {
  local templatestore tpl_name

  # Determine which storage holds templates (usually the 'local' storage)
  templatestore=$(pvesm status -content vztmpl 2>/dev/null | awk 'NR>1 {print $1}' | head -1)
  if [[ -z "$templatestore" ]]; then
    templatestore=$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 {print $1}' | head -1)
  fi
  [[ -z "$templatestore" ]] && templatestore="$CT_STORAGE"

  msg "Updating Proxmox template list..."
  pveam update >/dev/null 2>&1 || true

  # Find latest Debian 13 template name
  tpl_name=$(pveam available 2>/dev/null | grep "debian-13" | awk '{print $2}' | head -1)
  if [[ -z "$tpl_name" ]]; then
    tpl_name="debian-13-standard_13.1-2_amd64.tar.zst"
  fi

  # Check if already cached somewhere
  local existing
  existing=$(find /var/lib/vz/template/cache /var/tmp/pve* -name "*debian-13*" 2>/dev/null | head -1)
  if [[ -n "$existing" ]]; then
    CT_TPL_PATH="$existing"
    ok "Template already cached: $(basename "$existing")"
    return
  fi

  # Try pveam download (works for directory-based storages)
  msg "Downloading Debian 13 template..."
  if pveam download "$templatestore" "$tpl_name" >/dev/null 2>&1; then
    CT_TPL_PATH="/var/lib/vz/template/cache/${tpl_name}"
    # Check if pveam put it elsewhere
    local found
    found=$(find /var/lib/vz /var/tmp -path "*/template/cache/${tpl_name}" 2>/dev/null | head -1)
    [[ -n "$found" ]] && CT_TPL_PATH="$found"
    ok "Template downloaded"
    return
  fi

  # Fallback: direct download to /var/lib/vz/template/cache/
  local url="http://download.proxmox.com/images/system/${tpl_name}"
  msg "Direct download from: ${url}..."
  mkdir -p /var/lib/vz/template/cache
  curl -fsSL -o "/var/lib/vz/template/cache/${tpl_name}" "$url" >/dev/null 2>&1 || {
    fail "Download failed"
    err "Could not fetch Debian 13 template. Check URL: ${url}"
  }
  CT_TPL_PATH="/var/lib/vz/template/cache/${tpl_name}"
  ok "Template downloaded"
}

# ----- Container creation -----
create_container() {
  [[ -z "$CT_TPL_PATH" ]] && err "No template found."
  [[ ! -f "$CT_TPL_PATH" ]] && err "Template file missing: ${CT_TPL_PATH}"

  # Check if CT ID is in use
  if pct status "$CT_ID" &>/dev/null; then
    err "CT ID ${CT_ID} is already in use."
  fi

  msg "Creating LXC container ${CT_ID} (this may take a minute)..."
  note "Hostname: ${CT_HOSTNAME} | Cores: ${CT_CORES} | RAM: ${CT_RAM}MiB | Disk: ${CT_DISK}G"
  note "pct create output:"
  # Redirect stderr to stdout so the user sees progress
  pct create "$CT_ID" "$CT_TPL_PATH" \
    --hostname "$CT_HOSTNAME" \
    --cores "$CT_CORES" \
    --memory "$CT_RAM" \
    --rootfs "${CT_STORAGE}:${CT_DISK}" \
    --net0 "name=eth0,bridge=${CT_BRIDGE},ip=dhcp" \
    --password "$CT_PASSWORD" \
    --unprivileged 1 \
    --features "keyctl=1,nesting=1" \
    --tags "learn;debian-13" 2>&1 || err "pct create failed (exit code $?)"
  ok "Container ${CT_ID} created"

  msg "Starting container..."
  pct start "$CT_ID" >/dev/null 2>&1 || true
  ok "Container ${CT_ID} started"
}

# ----- Install Learn platform inside container -----
install_learn() {
  msg "Installing prerequisites inside container..."
  pct exec "$CT_ID" -- bash -c "apt-get update -qq 2>/dev/null && apt-get install -y -qq curl wget git python3 python3-pip python3-venv build-essential locales"
  pct exec "$CT_ID" -- locale-gen en_US.UTF-8 2>/dev/null || true
  ok "Prerequisites installed"

  # Install Node.js 24 LTS
  msg "Installing Node.js 24 LTS..."
  pct exec "$CT_ID" -- bash -c "curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y -qq nodejs"
  ok "Node.js $(pct exec "$CT_ID" -- node --version) installed"

  # Install TTS dependencies
  msg "Installing TTS engine..."
  pct exec "$CT_ID" -- pip3 install --break-system-packages --quiet --root-user-action=ignore --no-warn-script-location kokoro-onnx numpy
  ok "TTS dependencies installed"

  # Clone the repository
  msg "Cloning Learn platform..."
  pct exec "$CT_ID" -- git clone --depth 1 https://github.com/damessner/learn_.git /opt/learn
  ok "Repository cloned"

  # Create dedicated service user (least-privilege principle)
  msg "Creating 'learn' service user..."
  pct exec "$CT_ID" -- bash -c "groupadd -f learn && (id learn &>/dev/null || useradd -r -g learn -d /opt/learn -s /usr/sbin/nologin learn)"
  ok "Service user 'learn' created"

  # Generate .env
  msg "Configuring environment..."
  local secret
  secret=$(openssl rand -hex 32)
  pct exec "$CT_ID" -- bash -c "cat > /opt/learn/.env <<EOF
# Database (SQLite — relative to project root)
DATABASE_URL=\"file:./dev.db\"

# Required: 32+ character hex string for session encryption
SESSION_SECRET=\"${secret}\"

# Set to true only if you have HTTPS behind a reverse proxy
# SECURE_COOKIE=\"true\"

# --- Optional API Keys ---

# Google Gemini (AI writing coach, cloze generation)
# Get a free key: https://aistudio.google.com/apikey
# GEMINI_API_KEY=\"your_gemini_api_key\"
# GEMINI_MODEL=\"gemini-3.5-flash\"

# Pixabay (image search in worksheet creator)
# Get a free key: https://pixabay.com/api/docs/
# PIXABAY_API_KEY=\"your_pixabay_api_key\"

# --- Aloys AI (Socratic Tutor) ---

# AI provider: \"opencode\" (default), \"gemini\", or \"ollama\"
# ALOYS_AI_PROVIDER=\"opencode\"

# OpenCode GO (default provider)
# Get a key at https://opencode.go
# OPENCODE_API_KEY=\"your_opencode_api_key\"
# OPENCODE_MODEL=\"deepseek-v4-flash\"

# Ollama (local alternative)
# OLLAMA_API_BASE=\"http://localhost:11434\"
# OLLAMA_MODEL=\"gemma2\"
EOF"
  ok "Environment configured"

  # Set ownership before building — service user needs write access
  msg "Setting file ownership (learn:learn)..."
  pct exec "$CT_ID" -- chown -R learn:learn /opt/learn
  ok "Ownership set"

  # Install npm deps, build — run as learn user so build artefacts are not owned by root
  msg "Installing npm packages (this may take a few minutes)..."
  pct exec "$CT_ID" -- bash -c "cd /opt/learn && runuser -u learn -- npm install --no-audit --no-fund --loglevel=error"
  ok "npm packages installed"

  msg "Generating Prisma client..."
  pct exec "$CT_ID" -- bash -c "cd /opt/learn && runuser -u learn -- npx prisma generate"
  ok "Prisma client generated"

  msg "Pushing database schema..."
  pct exec "$CT_ID" -- bash -c "cd /opt/learn && runuser -u learn -- npx prisma db push --accept-data-loss"
  ok "Schema pushed"

  msg "Seeding database..."
  pct exec "$CT_ID" -- bash -c "cd /opt/learn && runuser -u learn -- npx prisma db seed" || note "Seed skipped (data may exist)"
  ok "Database seeded"

  msg "Building Next.js bundle (may take several minutes)..."
  pct exec "$CT_ID" -- bash -c "cd /opt/learn && runuser -u learn -- npm run build"
  ok "Build complete"

  # Generate break-glass emergency admin credential
  msg "Generating break-glass emergency admin credential..."
  local bg_pw bg_hash
  bg_pw=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 24)
  # Hash inside container (bcryptjs available post npm-install)
  bg_hash=$(pct exec "$CT_ID" -- node -e "const b=require('/opt/learn/node_modules/bcryptjs');console.log(b.hashSync('${bg_pw}',10))")
  # Append static block with single-quoted heredoc (no variable expansion inside)
  pct exec "$CT_ID" -- bash -c "cat >> /opt/learn/.env <<'BGENV'

# Break-glass emergency admin account — last-resort access when all admins are locked out.
BREAKGLASS_USERNAME=\"_breakglass\"
BGENV"
  # Write hash in single quotes so dotenv never expands the \$2b\$10\$... bcrypt prefix
  pct exec "$CT_ID" -- bash -c "printf \"BREAKGLASS_PASSWORD_HASH='%s'\\n\" '${bg_hash}' >> /opt/learn/.env"
  pct exec "$CT_ID" -- chown learn:learn /opt/learn/.env
  ok "Break-glass credential generated"

  echo ""
  echo -e "${BOLD}${RD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo -e "${BOLD}${RD}  🚨  BREAK-GLASS CREDENTIAL — SAVE THIS NOW  🚨${CL}"
  echo -e "${BOLD}${RD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo ""
  echo -e "     Username : ${DGN}_breakglass${CL}"
  echo -e "     Password : ${GN}${BOLD}${bg_pw}${CL}"
  echo ""
  echo -e "  ${YW}This password is shown ONCE. Only the bcrypt hash is saved — not the plaintext.${CL}"
  echo -e "  ${YW}Store it in your password manager immediately.${CL}"
  echo ""
  echo -e "${BOLD}${RD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
  echo ""

  # systemd service
  msg "Configuring systemd service..."
  pct exec "$CT_ID" -- bash -c "cat > /etc/systemd/system/learn.service <<UNIT
[Unit]
Description=Learn Platform
After=network.target

[Service]
Type=exec
User=learn
Group=learn
WorkingDirectory=/opt/learn
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
ExecStart=\$(which npm) start
Restart=always
RestartSec=10
# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/learn
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable learn.service"
  ok "systemd service configured"

  # Start the app
  msg "Starting Learn platform..."
  pct exec "$CT_ID" -- systemctl start learn.service
  ok "Learn platform started"

  # nginx (optional, if domain was provided)
  if [[ -n "$CT_DN" ]]; then
    msg "Setting up nginx reverse proxy..."
    pct exec "$CT_ID" -- bash -c "apt-get install -y -qq nginx"
    pct exec "$CT_ID" -- bash -c "cat > /etc/nginx/sites-available/learn <<NGX
upstream learn { server 127.0.0.1:3000; }
server {
    listen 80; listen [::]:80;
    server_name ${CT_DN};
    location / {
        proxy_pass http://learn;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
NGX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/learn /etc/nginx/sites-enabled/
systemctl start nginx"
    ok "nginx configured for ${CT_DN}"
  fi
}

# ----- Container Hardening -----
harden_container() {
  echo ""
  if ! prompt_yesno "Harden Container" \
    "Apply security hardening inside the container?

  ✦ fail2ban  — Ban IPs after 5 failed SSH logins (1-hour ban)
  ✦ nftables  — Firewall: allow 22/${APP_PORT}/80/443, drop all else
  ✦ SSH       — Optionally disable password auth (key-only login)

Recommended before any internet-facing exposure."; then
    note "Hardening skipped. Re-run learn-expose.sh to set up access."
    return
  fi

  # ── fail2ban ──
  msg "Installing fail2ban..."
  pct exec "$CT_ID" -- bash -c "apt-get install -y -qq fail2ban"
  ok "fail2ban installed"

  msg "Configuring fail2ban SSH jail..."
  pct exec "$CT_ID" -- bash -c "mkdir -p /etc/fail2ban/jail.d && cat > /etc/fail2ban/jail.d/learn.conf <<'JAIL'
[sshd]
enabled  = true
maxretry = 5
findtime = 600
bantime  = 3600
JAIL
systemctl enable --now fail2ban"
  ok "fail2ban active — SSH: 5 failures → 1 h ban"

  # ── nftables firewall ──
  msg "Installing nftables firewall..."
  pct exec "$CT_ID" -- bash -c "apt-get install -y -qq nftables"
  pct exec "$CT_ID" -- bash -c "cat > /etc/nftables.conf <<NFT
#!/usr/sbin/nft -f
# Learn Platform firewall — generated by learn-lxc.sh
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;
        iif lo accept
        ct state established,related accept
        ct state invalid drop
        ip  protocol icmp   accept
        ip6 nexthdr  icmpv6 accept
        tcp dport 22 accept
        tcp dport ${APP_PORT} accept
        tcp dport { 80, 443 } accept
    }
    chain forward {
        type filter hook forward priority 0; policy drop;
    }
    chain output {
        type filter hook output priority 0; policy accept;
    }
}
NFT"
  if pct exec "$CT_ID" -- bash -c "nft -f /etc/nftables.conf 2>/dev/null && systemctl enable --now nftables 2>/dev/null"; then
    ok "nftables firewall active (allow SSH/${APP_PORT}/80/443 — drop all else)"
  else
    fail "nftables could not load inside this LXC (CAP_NET_ADMIN not available in unprivileged container)."
    note "Alternative — enable the Proxmox web UI firewall for CT ${CT_ID}:"
    note "  Proxmox UI → CT ${CT_ID} → Firewall → Add rules for ports 22, ${APP_PORT}, 80, 443"
    note "  Datacenter → Firewall → Options → Enable firewall: Yes"
  fi

  # ── SSH hardening ──
  echo ""
  note "┌────────────────────────────────────────────────────────────┐"
  note "│ SSH Hardening (optional)                                   │"
  note "│                                                            │"
  note "│ Disabling password auth stops brute-force attacks cold.    │"
  note "│ You need an SSH key pair to log in after this step.        │"
  note "│                                                            │"
  note "│ Paste your PUBLIC key (from your workstation's             │"
  note "│ ~/.ssh/id_*.pub) — or leave blank to skip.                 │"
  note "└────────────────────────────────────────────────────────────┘"
  echo ""

  local ssh_pubkey
  ssh_pubkey=$(prompt_input "SSH Public Key" \
    "Paste your SSH public key (or leave blank to skip):" "")

  if [[ -n "$ssh_pubkey" ]]; then
    msg "Installing SSH public key inside container..."
    pct exec "$CT_ID" -- bash -c "
      mkdir -p /root/.ssh
      chmod 700 /root/.ssh
      echo '${ssh_pubkey}' >> /root/.ssh/authorized_keys
      chmod 600 /root/.ssh/authorized_keys"
    ok "SSH public key installed in /root/.ssh/authorized_keys"

    msg "Disabling SSH password authentication..."
    pct exec "$CT_ID" -- bash -c "
      sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
      sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
      systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || true"
    ok "SSH hardened — password auth disabled, key-only login active"
    note "To SSH in: ssh root@<container-ip>  (using your private key)"
  else
    note "SSH key not provided — password auth remains enabled."
    note "Add a key later: pct exec ${CT_ID} -- bash -c \"echo '<key>' >> /root/.ssh/authorized_keys\""
  fi
}

configure_env() {
  if ! prompt_yesno "Configure .env" \
    "Would you like to configure optional API keys now?\n\nYou can always edit /opt/learn/.env later."; then
    return
  fi

  local gemini_key pixabay_key provider opencode_key opencode_model ollama_base ollama_model
  local secure_cookie

  gemini_key=$(prompt_input "Gemini API Key" "Google Gemini (AI writing coach, cloze generation)\nGet a free key: https://aistudio.google.com/apikey\nLeave empty to skip" "")
  pixabay_key=$(prompt_input "Pixabay API Key" "Pixabay (image search in worksheet creator)\nGet a free key: https://pixabay.com/api/docs/\nLeave empty to skip" "")
  provider=$(prompt_input "Aloys AI Provider" "AI tutor provider: opencode (default), gemini, or ollama\nLeave empty for default" "")
  opencode_key=$(prompt_input "OpenCode API Key" "OpenCode GO API key (default AI provider)\nGet a key at https://opencode.go\nLeave empty to skip" "")
  opencode_model=$(prompt_input "OpenCode Model" "Model name (default: deepseek-v4-flash)\nLeave empty for default" "")
  ollama_base=$(prompt_input "Ollama API Base" "Ollama server URL (default: http://localhost:11434)\nLeave empty for default" "")
  ollama_model=$(prompt_input "Ollama Model" "Ollama model (default: gemma2)\nLeave empty for default" "")

  if prompt_yesno "Secure Cookie" "Enable secure cookies?\nOnly set YES if you have HTTPS behind a reverse proxy."; then
    secure_cookie="true"
  else
    secure_cookie=""
  fi

  msg "Writing configuration to /opt/learn/.env..."

  [[ -n "$gemini_key" ]]    && pct exec "$CT_ID" -- sed -i "s|^# GEMINI_API_KEY=.*|GEMINI_API_KEY=\"${gemini_key}\"|" /opt/learn/.env
  [[ -n "$pixabay_key" ]]   && pct exec "$CT_ID" -- sed -i "s|^# PIXABAY_API_KEY=.*|PIXABAY_API_KEY=\"${pixabay_key}\"|" /opt/learn/.env
  [[ -n "$provider" ]]      && pct exec "$CT_ID" -- sed -i "s|^# ALOYS_AI_PROVIDER=.*|ALOYS_AI_PROVIDER=\"${provider}\"|" /opt/learn/.env
  [[ -n "$opencode_key" ]]  && pct exec "$CT_ID" -- sed -i "s|^# OPENCODE_API_KEY=.*|OPENCODE_API_KEY=\"${opencode_key}\"|" /opt/learn/.env
  [[ -n "$opencode_model" ]] && pct exec "$CT_ID" -- sed -i "s|^# OPENCODE_MODEL=.*|OPENCODE_MODEL=\"${opencode_model}\"|" /opt/learn/.env
  [[ -n "$ollama_base" ]]   && pct exec "$CT_ID" -- sed -i "s|^# OLLAMA_API_BASE=.*|OLLAMA_API_BASE=\"${ollama_base}\"|" /opt/learn/.env
  [[ -n "$ollama_model" ]]  && pct exec "$CT_ID" -- sed -i "s|^# OLLAMA_MODEL=.*|OLLAMA_MODEL=\"${ollama_model}\"|" /opt/learn/.env
  [[ -n "$secure_cookie" ]] && pct exec "$CT_ID" -- sed -i "s|^# SECURE_COOKIE=.*|SECURE_COOKIE=\"true\"|" /opt/learn/.env

  pct exec "$CT_ID" -- systemctl restart learn.service 2>/dev/null || true
  ok "Configuration saved — learn.service restarted"
}

# ----- Summary -----
summary() {
  local ct_ip
  ct_ip=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')

  echo ""
  echo -e "${BOLD}${GN}============================================${CL}"
  echo -e "${BOLD}${GN}  ✅  Learn Platform LXC created!${CL}"
  echo -e "${BOLD}${GN}============================================${CL}"
  echo ""
  echo -e "  ${CHECK} Container: ${DGN}${CT_ID}${CL}"
  echo -e "  ${CHECK} Hostname:  ${DGN}${CT_HOSTNAME}${CL}"
  echo -e "  ${CHECK} Root PW:   ${DGN}${CT_PASSWORD}${CL}"
  echo -e "  ${INFO} Shell:     ${DGN}pct enter ${CT_ID}${CL}"
  echo ""

  if [[ -n "$ct_ip" ]]; then
    if [[ -n "$CT_DN" ]]; then
      echo -e "  ${CHECK} URL:       ${DGN}http://${CT_DN}${CL}"
    fi
    echo -e "  ${CHECK} URL:       ${DGN}http://${ct_ip}:3000${CL}"
  fi
  echo ""
  note "Management:"
  echo -e "    ${DGN}pct list${CL}         — list containers"
  echo -e "    ${DGN}pct enter ${CT_ID}${CL}  — shell into container"
  echo -e "    ${DGN}pct stop ${CT_ID}${CL}   — stop container"
  echo -e "    ${DGN}pct start ${CT_ID}${CL}  — start container"
  echo ""
  note "Inside the container:"
  echo -e "    ${DGN}journalctl -u learn -f${CL}         — app logs"
  echo -e "    ${DGN}systemctl restart learn${CL}        — restart app"
  echo -e "    ${DGN}nano /opt/learn/.env${CL}            — edit config"
  echo -e "    ${DGN}systemctl restart learn${CL}        — apply config changes"
  echo ""
  echo -e "${GN}============================================${CL}"
  echo ""
}

# ----- Main -----
main() {
  header
  echo -e "\n${INFO}${BOLD}Learn Platform LXC Creator for Proxmox VE${CL}\n"

  check_root
  check_proxmox
  check_arch
  detect_storage

  get_config

  header
  echo -e "\n${INFO}${BOLD}Creating Debian 13 LXC with Learn Platform...${CL}\n"

  download_template
  create_container
  install_learn
  harden_container
  configure_env

  summary
}

main "$@"
