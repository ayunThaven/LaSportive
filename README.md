# La Sportive

Application interne complémentaire à HelloAsso pour la conformité des inscriptions, la préparation des licences et le suivi des réductions.

## Architecture

- Client web : Next.js dans `apps/web`
- API métier versionnée : Fastify dans `apps/api`
- Base : PostgreSQL + Prisma
- Contrats partagés : `packages/contracts`

Le web et l’API sont deux applications distinctes. Voir [docs/architecture.md](docs/architecture.md).

## Démarrage en mode démonstration

```bash
npm install
copy .env.example .env
```

Définir `DEMO_MODE=true`. Les identifiants démo sont `association` / `demo-sportive` par défaut et peuvent être changés avec `DEMO_USERNAME` et `DEMO_PASSWORD`, puis lancer :

```bash
npm run dev
```

Ouvrir `http://localhost:3000`. Le mode démonstration n’appelle ni HelloAsso, ni SMTP, ni Google Drive.

## Production

1. Créer les identifiants API HelloAsso et un compte de service Google ayant accès au dossier Drive partagé. Pour la sandbox, utiliser `HELLOASSO_ENVIRONMENT=sandbox`; l’API bascule alors vers `api.helloasso-sandbox.com`.
2. Générer le dérivé `scrypt` `APP_PASSWORD_HASH` avec `npm run password:hash -w @la-sportive/api -- "mot-de-passe"`.
3. Renseigner les secrets décrits dans `.env.example` dans le gestionnaire de secrets de l’hébergeur.
4. Déployer PostgreSQL, l’API et le web dans une région européenne.
5. Exécuter les migrations puis le seed : `npm run db:migrate && npm run db:seed`.
6. Configurer la campagne et vérifier les mappings avant la première synchronisation réelle.

La synchronisation automatique utilise `SYNC_CRON` et s’exécute toutes les 15 minutes par défaut. Une synchronisation manuelle reste disponible dans l’interface.

## Déploiement sur Render

Le fichier [`render.yaml`](render.yaml) sert de référence pour la configuration ci-dessous ; il n’est pas nécessaire d’utiliser un Blueprint Render.

Créer manuellement deux services Docker dans la région de Francfort :

- `la-sportive-api` : API Fastify, offre **Starter** pour rester active et assurer les synchronisations planifiées ;
- `la-sportive-web` : interface Next.js, également en offre **Starter** afin d’éviter toute mise en veille côté utilisateur.

La base de données reste hébergée sur Neon. Créer d’abord un projet PostgreSQL Neon (région Europe), puis conserver sa chaîne de connexion dans `DATABASE_URL`.

1. Pousser ce dépôt sur GitHub.
2. Dans Render, choisir **New > Web Service**, connecter le dépôt GitHub, sélectionner la branche `master`, puis choisir **Docker**.
3. Créer d’abord l’API avec le nom `la-sportive-api`, le Dockerfile `apps/api/Dockerfile`, le contexte Docker `.`, l’offre **Starter**, et le health check `/health`. Ajouter les variables `NODE_ENV=production`, `API_PORT=10000`, `DATABASE_URL`, `APP_USERNAME`, `APP_PASSWORD_HASH`, `JWT_SECRET` (une valeur aléatoire d’au moins 32 caractères), `SYNC_CRON=*/15 * * * *` et les secrets des intégrations nécessaires.
4. Créer ensuite le web avec le nom `la-sportive-web`, le Dockerfile `apps/web/Dockerfile`, le contexte Docker `.`, et l’offre **Starter**. Ajouter `PORT=10000` et `NEXT_PUBLIC_API_URL=https://la-sportive-api.onrender.com/api/v1`.
5. Dans l’API, ajouter `WEB_ORIGIN=https://la-sportive-web.onrender.com` et `GOOGLE_OAUTH_REDIRECT_URL=https://la-sportive-api.onrender.com/api/v1/integrations/google-drive/callback`. Si Render ajoute un suffixe aux noms, employer les URLs effectivement affichées et redéployer les deux services.
6. Avant la première synchronisation réelle, exécuter une fois le seed depuis le poste local en utilisant temporairement l’URL Neon : `$env:DATABASE_URL="…"; npm run db:seed -w @la-sportive/api` (PowerShell). Le conteneur de production n’embarque pas le script TypeScript de seed.

Ne jamais importer le fichier local `.env` dans Git ou dans le build : saisir uniquement les valeurs de production dans le gestionnaire de variables d’environnement Render.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
```
