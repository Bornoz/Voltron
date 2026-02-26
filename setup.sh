#!/usr/bin/env bash
set -euo pipefail

# ╔═══════════════════════════════════════════════════════════════════╗
# ║  VOLTRON — AI Operation Control Center                          ║
# ║  Tek Komutla Kurulum / One-Command Installer                    ║
# ║  Author: Ömer Akdemir, Turkey                                   ║
# ╚═══════════════════════════════════════════════════════════════════╝

VOLTRON_VERSION="0.1.0"
VOLTRON_REPO="https://github.com/Bornoz/Voltron.git"
VOLTRON_DIR="/opt/voltron"
VOLTRON_PORT="${VOLTRON_PORT:-8600}"
VOLTRON_DASHBOARD_PORT="${VOLTRON_DASHBOARD_PORT:-6400}"
NODE_MIN_VERSION="20"
CLAUDE_CLI_NPM="@anthropic-ai/claude-code"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helpers ─────────────────────────────────────────────────

log()   { echo -e "${GREEN}[VOLTRON]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
step()  { echo -e "\n${BOLD}${BLUE}═══ $* ═══${NC}\n"; }

banner() {
  echo -e "${CYAN}"
  cat << 'BANNER'
 __      _____  _   _____ ____   ___  _   _
 \ \    / / _ \| | |_   _|  _ \ / _ \| \ | |
  \ \  / / | | | |   | | | |_) | | | |  \| |
   \ \/ /| | | | |   | | |  _ <| | | | . ` |
    \  / | |_| | |___| | | |_) | |_| | |\  |
     \/   \___/|_____|_| |____/ \___/|_| \_|
BANNER
  echo -e "${NC}"
  echo -e "  ${BOLD}AI Operation Control Center v${VOLTRON_VERSION}${NC}"
  echo -e "  ${CYAN}Author: Ömer Akdemir, Turkey${NC}"
  echo ""
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    error "Bu script root olarak calistirilmalidir."
    error "Lutfen sudo ile calistirin: sudo bash setup.sh"
    exit 1
  fi
}

# ── Step 1: System Dependencies ────────────────────────────

install_system_deps() {
  step "1/7 — Sistem Bagimliliklari Kontrol Ediliyor"

  local missing=()

  if ! command -v git &>/dev/null; then missing+=("git"); fi
  if ! command -v curl &>/dev/null; then missing+=("curl"); fi
  if ! command -v jq &>/dev/null; then missing+=("jq"); fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    log "Eksik paketler kuruluyor: ${missing[*]}"
    if command -v apt-get &>/dev/null; then
      apt-get update -qq
      apt-get install -y -qq "${missing[@]}"
    elif command -v yum &>/dev/null; then
      yum install -y "${missing[@]}"
    elif command -v dnf &>/dev/null; then
      dnf install -y "${missing[@]}"
    elif command -v pacman &>/dev/null; then
      pacman -Sy --noconfirm "${missing[@]}"
    else
      error "Paket yoneticisi bulunamadi. Manuel olarak kurun: ${missing[*]}"
      exit 1
    fi
  fi

  log "Sistem bagimliliklari tamam."
}

# ── Step 2: Node.js ────────────────────────────────────────

install_node() {
  step "2/7 — Node.js Kontrol Ediliyor"

  if command -v node &>/dev/null; then
    local node_ver
    node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ $node_ver -ge $NODE_MIN_VERSION ]]; then
      log "Node.js v$(node -v) mevcut (>= v${NODE_MIN_VERSION} gerekli)."
      return
    fi
    warn "Node.js v$(node -v) eski. v${NODE_MIN_VERSION}+ kuruluyor..."
  fi

  log "Node.js v22 kuruluyor (NodeSource)..."

  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
  elif command -v yum &>/dev/null || command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    if command -v dnf &>/dev/null; then
      dnf install -y nodejs
    else
      yum install -y nodejs
    fi
  else
    # Fallback: nvm
    warn "NodeSource desteklenmiyor, nvm ile kuruluyor..."
    export NVM_DIR="/root/.nvm"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    nvm alias default 22
  fi

  log "Node.js $(node -v) kuruldu."
}

# ── Step 3: pnpm ──────────────────────────────────────────

install_pnpm() {
  step "3/7 — pnpm Kontrol Ediliyor"

  if command -v pnpm &>/dev/null; then
    log "pnpm $(pnpm -v) mevcut."
    return
  fi

  log "pnpm kuruluyor..."
  corepack enable 2>/dev/null || npm install -g pnpm@latest
  log "pnpm $(pnpm -v) kuruldu."
}

# ── Step 4: Clone / Pull Voltron ──────────────────────────

setup_voltron() {
  step "4/7 — Voltron Kaynak Kodu"

  if [[ -d "$VOLTRON_DIR/.git" ]]; then
    log "Voltron dizini mevcut, guncelleniyor..."
    cd "$VOLTRON_DIR"
    git pull --ff-only origin main 2>/dev/null || {
      warn "Pull basarisiz, mevcut sürüm kullanilacak."
    }
  else
    log "Voltron klonlaniyor: $VOLTRON_REPO"
    git clone "$VOLTRON_REPO" "$VOLTRON_DIR"
    cd "$VOLTRON_DIR"
  fi

  log "Bagimliliklar kuruluyor..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install

  log "Projeler derleniyor..."
  pnpm build

  log "Voltron v${VOLTRON_VERSION} hazir."
}

# ── Step 5: Claude CLI ────────────────────────────────────

setup_claude_cli() {
  step "5/7 — Claude CLI Kurulumu ve Dogrulama"

  local claude_path=""

  # Check if Claude CLI is already installed
  if command -v claude &>/dev/null; then
    claude_path=$(command -v claude)
    log "Claude CLI mevcut: $claude_path"
  else
    log "Claude CLI kuruluyor..."
    npm install -g "$CLAUDE_CLI_NPM" 2>/dev/null || {
      error "Claude CLI kurulumu basarisiz."
      error "Manuel kurulum: npm install -g @anthropic-ai/claude-code"
      exit 1
    }

    # Find installed path
    if command -v claude &>/dev/null; then
      claude_path=$(command -v claude)
    else
      # Search common paths
      for p in \
        /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js \
        /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js \
        "$HOME/.npm/lib/node_modules/@anthropic-ai/claude-code/cli.js"; do
        if [[ -f "$p" ]]; then
          claude_path="$p"
          break
        fi
      done
    fi

    if [[ -z "$claude_path" ]]; then
      error "Claude CLI bulunamadi. Lutfen manuel kurun."
      exit 1
    fi
    log "Claude CLI kuruldu: $claude_path"
  fi

  # Export for Voltron server
  export VOLTRON_CLAUDE_PATH="$claude_path"

  # Check authentication
  echo ""
  info "Claude CLI dogrulama kontrol ediliyor..."

  local auth_ok=false
  # Try a simple command to check if authenticated
  if timeout 10 env -u CLAUDECODE "$claude_path" --print -p "Say OK" --output-format text --max-tokens 10 &>/dev/null; then
    auth_ok=true
  fi

  if $auth_ok; then
    log "Claude CLI dogrulama BASARILI — API erisimi aktif."
  else
    echo ""
    echo -e "${BOLD}${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${YELLOW}║  Claude CLI Dogrulama Gerekli                            ║${NC}"
    echo -e "${BOLD}${YELLOW}╠═══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  Claude hesabinizla giris yapmaniz gerekiyor.            ║${NC}"
    echo -e "${YELLOW}║  Asagidaki komutu calistirin ve yönergeleri izleyin:     ║${NC}"
    echo -e "${YELLOW}║                                                          ║${NC}"
    echo -e "${YELLOW}║  ${BOLD}claude auth login${NC}${YELLOW}                                      ║${NC}"
    echo -e "${YELLOW}║                                                          ║${NC}"
    echo -e "${YELLOW}║  Browser acilacak → Giris yapin → Dogrulama kodu girin   ║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    read -rp "$(echo -e "${CYAN}Claude CLI dogrulamasini simdi yapmak ister misiniz? [E/h]: ${NC}")" do_auth
    do_auth=${do_auth:-E}

    if [[ "$do_auth" =~ ^[EeYy]$ ]]; then
      log "Claude dogrulama baslatiliyor..."
      env -u CLAUDECODE "$claude_path" auth login || {
        warn "Dogrulama basarisiz olabilir. Daha sonra tekrar deneyebilirsiniz."
      }

      # Verify after auth
      if timeout 10 env -u CLAUDECODE "$claude_path" --print -p "Say OK" --output-format text --max-tokens 10 &>/dev/null; then
        log "Claude dogrulama BASARILI!"
      else
        warn "Dogrulama tamamlanamadi. Voltron yine de kurulacak."
        warn "Agent ozellikleri icin daha sonra 'claude auth login' calistirin."
      fi
    else
      info "Dogrulama atlanıyor. Daha sonra 'claude auth login' calistirin."
    fi
  fi

  echo ""
}

# ── Step 6: Environment Setup ─────────────────────────────

setup_environment() {
  step "6/7 — Ortam Yapilandirmasi"

  # Create data directory
  mkdir -p "$VOLTRON_DIR/data"
  mkdir -p "$VOLTRON_DIR/data/uploads"

  # Generate secrets if not set
  local interceptor_secret auth_secret
  interceptor_secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
  auth_secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)

  # Write env file
  local env_file="$VOLTRON_DIR/.env"
  if [[ ! -f "$env_file" ]]; then
    cat > "$env_file" << EOF
# Voltron Environment Configuration
# Auto-generated by setup.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")

NODE_ENV=production
VOLTRON_PORT=${VOLTRON_PORT}
VOLTRON_HOST=0.0.0.0
VOLTRON_DB_PATH=${VOLTRON_DIR}/data/voltron.db
VOLTRON_LOG_LEVEL=info
VOLTRON_INTERCEPTOR_SECRET=${interceptor_secret}
VOLTRON_AUTH_SECRET=${auth_secret}
VOLTRON_CLAUDE_PATH=${VOLTRON_CLAUDE_PATH:-claude}
VOLTRON_AGENT_MODEL=claude-sonnet-4-6
VOLTRON_ADMIN_USER=admin
VOLTRON_ADMIN_PASS=voltron2026
EOF
    chmod 600 "$env_file"
    log ".env dosyasi olusturuldu."
    info "Varsayilan admin: admin / voltron2026"
    warn "ONEMLI: Uretim ortaminda sifreyi degistirin!"
  else
    log ".env dosyasi zaten mevcut, korunuyor."
  fi

  # Create systemd service
  local service_file="/etc/systemd/system/voltron.service"
  if [[ ! -f "$service_file" ]]; then
    cat > "$service_file" << EOF
[Unit]
Description=Voltron AI Operation Control Center
After=network.target
Documentation=https://github.com/Bornoz/Voltron

[Service]
Type=simple
User=root
WorkingDirectory=${VOLTRON_DIR}
EnvironmentFile=${VOLTRON_DIR}/.env
ExecStart=/usr/bin/env node ${VOLTRON_DIR}/packages/server/dist/index.js
Restart=on-failure
RestartSec=5
LimitNOFILE=4096

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${VOLTRON_DIR}/data

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    log "Systemd servis dosyasi olusturuldu."
  else
    log "Systemd servis dosyasi zaten mevcut."
  fi
}

# ── Step 7: Start & Open ──────────────────────────────────

start_voltron() {
  step "7/7 — Voltron Baslatiliyor"

  # Source env
  if [[ -f "$VOLTRON_DIR/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$VOLTRON_DIR/.env"
    set +a
  fi

  # Remove Claude env vars that cause issues
  unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT CLAUDE_DEV

  # Start service
  if systemctl is-active --quiet voltron 2>/dev/null; then
    log "Voltron servisi zaten calisiyor, yeniden baslatiliyor..."
    systemctl restart voltron
  else
    systemctl enable voltron 2>/dev/null || true
    systemctl start voltron
  fi

  # Wait for server to be ready
  local max_wait=30
  local waited=0
  info "Sunucu baslatiliyor..."

  while [[ $waited -lt $max_wait ]]; do
    if curl -sf "http://localhost:${VOLTRON_PORT}/api/health" &>/dev/null; then
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done

  if [[ $waited -ge $max_wait ]]; then
    warn "Sunucu ${max_wait}s icinde baslamadi."
    warn "Log kontrol edin: journalctl -u voltron -f"
    return 1
  fi

  log "Voltron sunucusu calisiyor: http://localhost:${VOLTRON_PORT}"

  # Try to detect and open browser
  local ui_url="http://localhost:${VOLTRON_PORT}"
  echo ""
  echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║                                                          ║${NC}"
  echo -e "${BOLD}${GREEN}║  ✓ VOLTRON KURULUMU TAMAMLANDI!                          ║${NC}"
  echo -e "${BOLD}${GREEN}║                                                          ║${NC}"
  echo -e "${GREEN}║  Sunucu : ${BOLD}http://localhost:${VOLTRON_PORT}${NC}${GREEN}                     ║${NC}"
  echo -e "${GREEN}║  Admin  : ${BOLD}admin / voltron2026${NC}${GREEN}                          ║${NC}"
  echo -e "${GREEN}║                                                          ║${NC}"
  echo -e "${GREEN}║  Faydali Komutlar:                                       ║${NC}"
  echo -e "${GREEN}║    systemctl status voltron    — Durum kontrol           ║${NC}"
  echo -e "${GREEN}║    systemctl restart voltron   — Yeniden baslat          ║${NC}"
  echo -e "${GREEN}║    journalctl -u voltron -f    — Canli loglar            ║${NC}"
  echo -e "${GREEN}║    claude auth login           — Claude dogrulama        ║${NC}"
  echo -e "${GREEN}║                                                          ║${NC}"
  echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Try to open browser
  if command -v xdg-open &>/dev/null; then
    xdg-open "$ui_url" 2>/dev/null &
  elif command -v open &>/dev/null; then
    open "$ui_url" 2>/dev/null &
  elif command -v sensible-browser &>/dev/null; then
    sensible-browser "$ui_url" 2>/dev/null &
  else
    info "Tarayicinizi acin: $ui_url"
  fi
}

# ── Main ───────────────────────────────────────────────────

main() {
  banner
  check_root
  install_system_deps
  install_node
  install_pnpm
  setup_voltron
  setup_claude_cli
  setup_environment
  start_voltron
}

main "$@"
