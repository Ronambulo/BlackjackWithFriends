#!/bin/bash
set -euo pipefail

DATABASE_PATH="${DATABASE_PATH:-/data/blackjack.db}"
SECRETS_DIR="/data/.blackjack-secrets"

mkdir -p "$(dirname "$DATABASE_PATH")" "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# El secreto que firma las sesiones se genera una vez y se queda en el volumen:
# así las sesiones sobreviven a reinicios y actualizaciones de la imagen.
if [ ! -s "$SECRETS_DIR/auth_secret" ]; then
  head -c 32 /dev/urandom | base64 > "$SECRETS_DIR/auth_secret"
  chmod 600 "$SECRETS_DIR/auth_secret"
fi

if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  export BETTER_AUTH_SECRET
  BETTER_AUTH_SECRET="$(cat "$SECRETS_DIR/auth_secret")"
fi

export DATABASE_PATH
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:${PORT:-3000}}"

# Las migraciones las aplica la API al arrancar (backend/server.ts).
exec supervisord -n -c /etc/supervisor/conf.d/blackjack.conf
