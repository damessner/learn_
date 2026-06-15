# Implementation Plan: Curl-to-Bash Install Script for Learn Platform

**Date:** 2026-06-15  
**Target:** Debian 13 (Trixie)  
**Script:** `install.sh` — runnable via `curl -fsSL https://raw.githubusercontent.com/damessner/learn_/main/install.sh | bash`

---

## Script Design Overview

One single `install.sh` in the repo root, following the Proxmox VE Helper Script pattern:

1. **Header & UI** — ASCII art "Learn" logo, color-coded output, emoji indicators
2. **Prerequisite checks** — root check, Debian 13 check, arch check
3. **Guided whiptail flow** — simple "Proceed?" → configure key options
4. **Automatic install** — Node.js, Python/TTS deps, git clone to `/opt/learn`, `.env` generation, build, systemd service, nginx reverse proxy (optional SSL)
5. **Error handling** — trap-based cleanup on SIGINT/SIGTERM/ERR, temp dir management

---

## Flow Diagram

```
curl ... | bash
    │
    ├─ header_info() ─── ASCII art
    ├─ check_root()
    ├─ check_debian13()
    ├─ arch_check()
    │
    ├─ whiptail: "Install Learn Platform?"
    │   └─ Exit if No
    │
    ├─ whiptail: "Install nginx + Let's Encrypt?"
    │   ├─ No  → systemd only on port 3000
    │   └─ Yes → optionally set up SSL domain
    │
    ├─ whiptail (if SSL): Domain name input
    │   └─ Validates domain format
    │
    ├─ msg_info/msg_ok pipeline:
    │   1. Update apt & install prerequisites (git, curl, python3-pip, nginx, certbot...)
    │   2. Install Node.js 18+ via NodeSource
    │   3. Clone repo to /opt/learn
    │   4. Generate .env with random SESSION_SECRET
    │   5. npm install
    │   6. npx prisma db push && npx prisma db seed
    │   7. npm run build
    │   8. Install Python TTS deps (kokoro-onnx, numpy)
    │   9. Create systemd service (learn.service)
    │  10. (Optional) Configure nginx reverse proxy + certbot SSL
    │  11. Start & enable services
    │
    └─ msg_ok + print summary (URL, credentials note, etc.)
```

---

## File to Create

### `install.sh` — Root of the repo

Single self-contained bash script. Key sections:

#### A. Header & Variables
```bash
#!/usr/bin/env bash
# Learn Platform Installer
# curl -fsSL https://raw.githubusercontent.com/damessner/learn_/main/install.sh | bash

YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
GN=$(echo "\033[1;92m")
CL=$(echo "\033[m")
CM="✔️"
CROSS="✖️"
INFO="💡"
```

ASCII art logo:
```
    __                   
   / /   ___  ____  _____
  / /   / _ \/ __ \/ ___/
 / /___/  __/ / / / /__  
/_____/\___/_/ /_/\___/  
```

#### B. Helper Functions
- `msg_info()`, `msg_ok()`, `msg_error()`
- `check_root()`
- `check_debian13()` — verifies `/etc/debian_version` starts with `13`
- `arch_check()` — verifies `amd64`
- `exit_script()` — clean exit handler
- Error trap with `cleanup()`

#### C. Prerequisite Installation

| Package | Source | Purpose |
|---------|--------|---------|
| git, curl, wget | apt | Repo clone & download |
| python3, python3-pip, python3-venv | apt | TTS engine |
| build-essential | apt | Native npm modules (better-sqlite3) |
| nginx | apt | Reverse proxy |
| certbot, python3-certbot-nginx | apt (if SSL) | Let's Encrypt |
| Node.js 18+ | NodeSource setup script | Runtime |

#### D. Node.js Installation (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
```

#### E. App Setup (`/opt/learn`)

```bash
git clone https://github.com/damessner/learn_.git /opt/learn
cd /opt/learn
SESSION_SECRET=$(openssl rand -hex 32)
cat > .env <<EOF
DATABASE_URL="file:./dev.db"
SESSION_SECRET="${SESSION_SECRET}"
EOF
npm install
npx prisma db push --accept-data-loss
npx prisma db seed
npm run build
```

#### F. Python TTS Dependencies

```bash
python3 -m venv /opt/learn/venv
source /opt/learn/venv/bin/activate
pip install kokoro-onnx numpy
```

Update the TTS generator.ts to use this venv Python path if needed (or make the venv discoverable globally).

**Actually**, let me look at `generator.ts` to see how it calls Python.

Let me check this.

Actually, I know from the earlier exploration that it uses a child process to call Python. Let me check the path it uses. I'll look when I'm writing the script. For the plan, I'll note that we need to ensure the Python path is set correctly.

#### G. Systemd Service (`/etc/systemd/system/learn.service`)

```ini
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
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### H. Nginx Reverse Proxy (Config)

```
/etc/nginx/sites-available/learn
```

Proxy to `http://localhost:3000`, with WebSocket support, static asset caching, and security headers.

#### I. Certbot SSL (Optional)

If the user provides a domain, run `certbot --nginx -d <domain>` after nginx is configured.

#### J. Summary Output

```
✅ Learn Platform installed successfully!
   URL:    http://<server-ip>:3000  (or https://<domain> if SSL)
   Config: /opt/learn/.env
   Logs:   journalctl -u learn -f
```

---

## Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `install.sh` | **Create** | The install script |
| `implementation_plan.md` | Update | Replace with this plan |

---

## Out of Scope

- Docker containerization (deferred)
- PostgreSQL support (SQLite only for now)
- Multi-instance / high-availability setup
- Migration from older installs
- Monitoring/alerting integration
