#!/usr/bin/env bash
#
# Mama Bot - Automatisches Deployment (Cloudflare Free Tier)
#
# Verwendung:
#   ./deploy.sh          # Infrastruktur pruefen, Migrationen, Checks, Deploy
#   ./deploy.sh secrets  # Nur Secrets aus secrets.env setzen
#   ./deploy.sh --no-check  # Deploy ohne Typecheck/Tests
#
# Voraussetzung: einmalig "npx wrangler login" (Browser) und
# die Meta-Zugangsdaten in secrets.env (siehe META_SETUP.md).
#
set -euo pipefail
cd "$(dirname "$0")"

WORKER_NAME="mama-bot"
DB_NAME="mama-bot-db"
QUEUE_NAME="mama-bot-inbound"
D1_ID_PLACEHOLDER="REPLACE_WITH_D1_DATABASE_ID"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

check_login() {
  if ! npx wrangler whoami 2>/dev/null | grep -q "You are logged in"; then
    red "Nicht bei Cloudflare eingeloggt. Bitte ausfuehren: npx wrangler login"
    exit 1
  fi
  green "Cloudflare Login OK"
}

ensure_queue() {
  if npx wrangler queues list 2>/dev/null | grep -q "$QUEUE_NAME"; then
    green "Queue '$QUEUE_NAME' existiert bereits"
  else
    yellow "Erstelle Queue '$QUEUE_NAME' ..."
    npx wrangler queues create "$QUEUE_NAME"
    green "Queue '$QUEUE_NAME' erstellt"
  fi
}

ensure_d1() {
  local id
  id=$(grep -E '^[[:space:]]*database_id[[:space:]]*=' wrangler.toml | head -1 | sed -E 's/.*=[[:space:]]*"([^"]+)".*/\1/')
  if [ -z "$id" ] || [ "$id" = "$D1_ID_PLACEHOLDER" ]; then
    yellow "D1-ID fehlt in wrangler.toml - pruefe, ob '$DB_NAME' existiert ..."
    local existing
    existing=$(npx wrangler d1 list 2>/dev/null | grep "$DB_NAME" | grep -oE '[0-9a-f-]{36}' | head -1)
    if [ -n "$existing" ]; then
      id="$existing"
      yellow "Nutze bestehende D1 '$DB_NAME' mit ID $id"
    else
      yellow "Erstelle D1 '$DB_NAME' ..."
      local out
      out=$(npx wrangler d1 create "$DB_NAME")
      id=$(echo "$out" | grep -oE '[0-9a-f-]{36}' | head -1)
      green "D1 '$DB_NAME' erstellt (ID $id)"
    fi
    sed -i.bak "s|$D1_ID_PLACEHOLDER|$id|" wrangler.toml && rm -f wrangler.toml.bak
    green "D1-ID in wrangler.toml eingetragen"
  else
    green "D1 konfiguriert (ID ${id:0:8}...)"
  fi
}

apply_migrations() {
  yellow "Wende D1-Migrationen an (remote) ..."
  npx wrangler d1 migrations apply DB --remote
  green "D1-Migrationen angewendet"
}

set_secrets() {
  if [ ! -f secrets.env ]; then
    yellow "Keine secrets.env gefunden - ueberspringe Secrets."
    yellow "Erstelle secrets.env nach Anleitung in META_SETUP.md (cp secrets.env.example secrets.env)."
    return
  fi
  # Robustes Parsen: nur am ERSTEN '=' splitten, damit Werte mit '='
  # (z. B. lange Tokens) unverfaelscht bleiben. Kommentare und leere
  # Zeilen werden uebersprungen; leere Werte lassen Secrets unveraendert.
  while IFS= read -r line; do
    [[ "$line" == *=* ]] || continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key=$(printf '%s' "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    value=$(printf '%s' "$value" | sed -e 's/\r$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    case "$key" in
      WHATSAPP_TOKEN | WHATSAPP_PHONE_NUMBER_ID | WHATSAPP_VERIFY_TOKEN | META_APP_SECRET | MOTHER_PHONE)
        if [ -n "$value" ]; then
          yellow "Setze Secret $key ..."
          printf '%s' "$value" | npx wrangler secret put "$key" --name "$WORKER_NAME" >/dev/null
        fi
        ;;
    esac
  done < secrets.env
  green "Secrets aus secrets.env gesetzt"
}

run_checks() {
  if [ "${SKIP_CHECK:-0}" = "1" ]; then
    yellow "Checks uebersprungen (--no-check)"
    return
  fi
  yellow "Typecheck ..."
  npm run typecheck
  yellow "Tests ..."
  npm test
  green "Alle Checks bestanden"
}

deploy() {
  yellow "Deploye Worker '$WORKER_NAME' ..."
  npx wrangler deploy
  green "Deployment abgeschlossen"
}

print_summary() {
  echo
  green "=================================================="
  green " Mama Bot ist deployed - naechste Schritte:"
  green "=================================================="
  echo " 1. Webhook-URL bei Meta eintragen:"
  echo "    https://mama-bot.<dein-subdomain>.workers.dev/webhook"
  echo " 2. Verify-Token bei Meta: exakt WHATSAPP_VERIFY_TOKEN aus secrets.env"
  echo " 3. Health-Check:"
  echo "    curl -s https://mama-bot.<dein-subdomain>.workers.dev/health"
  echo "    curl -s https://mama-bot.<dein-subdomain>.workers.dev/health/config"
  echo
  yellow "Die genaue workers.dev-URL zeigt dir das Deployment oben."
}

if [ "${1:-}" = "secrets" ]; then
  check_login
  set_secrets
  exit 0
fi

if [ "${1:-}" = "--no-check" ]; then
  SKIP_CHECK=1
fi

check_login
ensure_queue
ensure_d1
apply_migrations
set_secrets
run_checks
deploy
print_summary
