#!/usr/bin/env bash
# Push prod env vars to Vercel via CLI.
# Usa --value para non-interactive. --force pra sobrescrever se já existe.
set -euo pipefail

VC="/c/Users/Matheus/.npm-global/vercel.cmd"
ENV="production"

push() {
	local name="$1"
	local value="$2"
	echo "→ $name"
	"$VC" env rm "$name" "$ENV" --yes 2>/dev/null || true
	"$VC" env add "$name" "$ENV" --value "$value" --yes
}

# Carrega .env.local
set -a
source .env.local
set +a

push PUBLIC_SUPABASE_URL "$PUBLIC_SUPABASE_URL"
push PUBLIC_SUPABASE_ANON_KEY "$PUBLIC_SUPABASE_ANON_KEY"
push SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
push DATABASE_URL "$DATABASE_URL"
push DATABASE_URL_DIRECT "$DATABASE_URL_DIRECT"
push GOOGLE_GENERATIVE_AI_API_KEY "$GOOGLE_GENERATIVE_AI_API_KEY"
push AI_MODEL_PRIMARY "${AI_MODEL_PRIMARY:-gemini-2.5-pro}"
push AI_MODEL_FAST "${AI_MODEL_FAST:-gemini-2.5-flash}"
push AI_MODEL_EMBEDDING "${AI_MODEL_EMBEDDING:-gemini-embedding-001}"

echo ""
echo "Done. Para PUBLIC_APP_URL (depende do domínio final), defina depois do primeiro deploy."
