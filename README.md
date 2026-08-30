# harmony.

Base de projet **Harmony** — tableau de bord sombre propulsé par SvelteKit, TypeScript,
Tailwind CSS, **shadcn-svelte** et **Convex** (base de données, backend & realtime,
avec authentification Convex Auth par e-mail + mot de passe).

## Stack

| Couche | Technologie | Rôle |
| --- | --- | --- |
| Web frontend | SvelteKit + TypeScript | Interface |
| Backend / DB | Convex | Base de données + backend + realtime |
| Auth | Convex Auth (`@convex-dev/auth`) — provider Password | E-mail + mot de passe |
| Styles | Tailwind CSS v4 + shadcn-svelte | Composants UI, thème sombre « beastmode » |
| Icônes | `@lucide/svelte` | Icônes |

## Démarrage rapide

```bash
npm install
npm run dev
```

Le tableau de bord s'affiche sur `http://localhost:5173`. Le front est relié au déploiement
Convex de production (`PUBLIC_CONVEX_URL` dans `.env`).

## Déploiements Convex

Les fonctions Convex vivent dans `src/convex/` (déclaré dans `convex.json`).
Le projet est déployé en **production** : `https://outgoing-octopus-902.eu-west-1.convex.cloud`.

**Tous les déploiements partent en production** :

```bash
npx convex deploy
```

Le CLI lit `.env.local` (gitignoré) : `CONVEX_DEPLOYMENT` (URL de production)
et `CONVEX_DEPLOY_KEY` (clé de déploiement production). Il régénère
`src/convex/_generated/`, pousse le schéma et les fonctions.

`npx convex dev` est réservé aux déploiements de dev ; les previews se gèrent
avec `npx convex deploy --preview-name <nom>`.

## Authentification (e-mail + mot de passe)

- Provider `Password` configuré dans `src/convex/auth.ts` (flows `signUp`, `signIn`, reset).
- Page `/connexion` : connexion / inscription avec onglets shadcn.
- Token de session stocké localement et appliqué au client Convex
  (`src/lib/convex-auth.ts`), état réactif dans `src/lib/auth-state.svelte.ts`.
- Pour protéger une requête côté backend : `getAuthUserId(ctx)` (exemple : `getMe` dans `example.ts`).

## Structure

```text
src/
  convex/            # Backend Convex (schéma, auth, http, fonctions)
    schema.ts        # Schéma final (authTables + tables du projet)
    auth.ts          # Convex Auth — provider Password
    auth.config.ts   # Domaine du site pour Convex Auth
    http.ts          # Routes HTTP (Connexion / OAuth)
    example.ts       # Exemple de query / mutation + requête protégée
    _generated/      # Code généré par Convex (ne pas modifier à la main)
  lib/
    components/      # Sidebar, Topbar, PillTabs, StatsTable…
    components/ui/   # Composants shadcn-svelte (button, card, input, tabs…)
    convex-auth.ts   # Helpers client (token, connexion, déconnexion)
    auth-state.svelte.ts # État réactif d'authentification
    data/dashboard.ts# Données d'exemple de l'interface
  routes/
    +layout.svelte   # Coquille : sidebar + panneau principal
    +page.svelte     # Tableau de bord
    connexion/       # Page de connexion / inscription
convex.json          # Déclare le dossier de fonctions Convex
.env.local           # Secrets Convex locaux (gitignoré)
```

## Remarques

- Le rendu est pensé pour être fidèle au style graphique de référence : fond quasi noir,
  cartes arrondies, bordures subtiles, onglets en pastille, tableaux en squelette.
- On ne lance jamais de build ni de déploiement sans demande explicite.
