#!/usr/bin/env bash
# Déploiement de l'app web Bravaux sur Vercel :
#  1. vérifie l'authentification Vercel (vercel login, une seule fois)
#  2. lie le projet au dépôt / nom de projet cible
#  3. injecte PUBLIC_CONVEX_URL + PUBLIC_MAPBOX_TOKEN en environnement "production"
#  4. déploie en production (--prod)
#
# Pré-requis (une fois) :  npm run vercel:login
# Usage :
#   npm run vercel:deploy                 # utilise le nom de projet par défaut (harmonytours)
#   VERCEL_PROJECT=mon-projet npm run vercel:deploy
#   VERCEL_SCOPE=mon-org npm run vercel:deploy    # si plusieurs équipes sur le compte
set -euo pipefail

cd "$(dirname "$0")/.."

# Node v26 + engine-strict=true font échouer l'installation du CLI Vercel
# (exige Node ^20.9/^22.11/^24). On désactive le contrôle d'engine uniquement
# pour ces commandes afin que npx puisse installer et lancer vercel.
export npm_config_engine_strict=false

VERCEL="npx --yes vercel"
PROJECT="${VERCEL_PROJECT:-harmonytours}"
SCOPE="${VERCEL_SCOPE:-}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# --- 1) Authentification ---
if ! $VERCEL whoami >/dev/null 2>&1; then
	die "Non authentifié sur Vercel.
Lance une fois (interactif) :   npx vercel login
places-toi sur le bon compte, puis relance  npm run vercel:deploy"
fi
say "Authentifié : $($VERCEL whoami)"

# --- 2) Liaison au projet ---
if [ ! -d .vercel ]; then
	say "Liaison du projet Vercel « $PROJECT » (créé si besoin)"
	if [ -n "$SCOPE" ]; then
		$VERCEL link --yes --project "$PROJECT" --scope "$SCOPE"
	else
		$VERCEL link --yes --project "$PROJECT"
	fi
else
	say "Projet déjà lié (.vercel présent)"
fi

# --- Récupération des valeurs publiques depuis .env (sans les afficher) ---
get_env() { sed -n "s/^$1=//p" .env 2>/dev/null | head -1 | tr -d '\r'; }
PUBLIC_CONVEX_URL="${PUBLIC_CONVEX_URL:-$(get_env PUBLIC_CONVEX_URL)}"
PUBLIC_MAPBOX_TOKEN="${PUBLIC_MAPBOX_TOKEN:-$(get_env PUBLIC_MAPBOX_TOKEN)}"

env_present() {
	local name="$1"
	$VERCEL env ls production 2>/dev/null | awk '{print $1}' | grep -qx "$name"
}

# --- 3) Injection des variables en production (upsert) ---
upsert_env() {
	local name="$1" value="$2"
	if [ -z "$value" ]; then
		echo "  ⚠️  $name est vide — ignorée (vérifie qu'elle est dans .env ou en variable d'env)."
		return 0
	fi
	if env_present "$name"; then
		say "Mise à jour de $name en production"
		$VERCEL env rm "$name" production --yes >/dev/null
	fi
	say "Ajout de $name en production"
	# Les variables PUBLIC_* sont lues par le client (navigateur) : elles doivent
	# être de type "config" (exposées publiquement), pas "secret".
	printf '%s' "$value" | $VERCEL env add "$name" production --type config
}

upsert_env PUBLIC_CONVEX_URL "$PUBLIC_CONVEX_URL"
upsert_env PUBLIC_MAPBOX_TOKEN "$PUBLIC_MAPBOX_TOKEN"

# --- 4) Déploiement en production ---
say "Déploiement en production…"
$VERCEL --prod --yes

say "✅ Déployé. Vérifie : https://$PROJECT.vercel.app"