# Walkthrough: Curl-to-Bash Install Script

## Created: `install.sh` (579 lines)

A self-contained Debian 13 install script modeled after the Proxmox VE Helper Script pattern. Runnable via:

```bash
# Public repo:
curl -fsSL https://raw.githubusercontent.com/damessner/learn_/main/install.sh | bash

# Private repo (with GitHub personal access token):
curl -H "Authorization: token $GITHUB_TOKEN" -fsSL \
  https://raw.githubusercontent.com/damessner/learn_/main/install.sh | bash
```

### Script Architecture

| Section | Lines | Purpose |
|---------|-------|---------|
| Header & Colors | 1–51 | Proxmox-style color/icon variables, error traps |
| ASCII Art | 53–71 | "Learn" logo header |
| Helpers | 73–112 | `msg_info`, `msg_ok`, `msg_error`, `error_handler`, `cleanup` |
| Prerequisite Checks | 114–172 | root, Debian 13, amd64 arch, min RAM/disk |
| Guided Install | 174–239 | whiptail flow: welcome → nginx? → domain? → SSL? → confirm |
| Install Steps | 241–488 | 10 sequential steps (see below) |
| Summary Output | 490–540 | URL, config path, management commands, first steps |

### Installation Pipeline

1. **`step_prerequisites`** — apt update, install git, curl, python3, build-essential, etc.
2. **`step_nodejs`** — Install Node.js 22.x via NodeSource (skips if 18+ already present)
3. **`step_tts_deps`** — `pip3 install kokoro-onnx numpy` (with `--break-system-packages` for Debian 13's PEP 668)
4. **`step_create_user`** — Creates `learn:learn` system user (no login shell)
5. **`step_clone_repo`** — `git clone` to `/opt/learn` (or `git pull` if already exists)
6. **`step_env_file`** — Generate `.env` with `openssl rand -hex 32` for `SESSION_SECRET`
7. **`step_npm_install`** — `npm install`, `prisma generate`, `prisma db push`, `prisma db seed`
8. **`step_build`** — `npm run build` (Next.js production bundle)
9. **`step_systemd`** — Register `learn.service` (runs as `learn` user, auto-restart)
10. **`step_nginx`** — nginx reverse proxy config + optional Certbot SSL

### Configurable via Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `INSTALL_DIR` | `/opt/learn` | App installation path |
| `REPO_URL` | GitHub repo | Git remote URL |
| `BRANCH` | `main` | Git branch |
| `APP_PORT` | `3000` | Next.js listen port |
| `LEARN_USER` | `learn` | System service user |
| `NODE_MAJOR` | `22` | Node.js major version |

### Files Changed

| File | Action |
|------|--------|
| `install.sh` | Created (579 lines, executable) |
| `implementation_plan.md` | Updated with script design |
