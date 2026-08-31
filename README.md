# La Sportive

**La Sportive** est une application web full-stack conçue comme un outil complémentaire à HelloAsso pour simplifier et digitaliser le suivi administratif des adhésions d’une association sportive.

L’application centralise les inscriptions, contrôle leur conformité, prépare les informations nécessaires aux licences, suit les dispositifs de réduction et facilite la récupération des informations ou documents manquants auprès des adhérents.

## Fonctionnalités principales

* Synchronisation des adhésions depuis l’API HelloAsso.
* Contrôle de conformité des inscriptions et détection des informations manquantes.
* Préparation et consultation des données nécessaires aux licences.
* Suivi des dispositifs de réduction et de leurs justificatifs.
* Suivi des autorisations liées aux adhésions.
* Relances par e-mail via l’API Brevo.
* Intégration Google Drive pour la gestion de documents.
* Configuration des correspondances entre les champs HelloAsso et les données métier.
* Synchronisation manuelle ou planifiée par tâche cron.
* Mode démonstration fonctionnant sans services externes.

## Stack technique

| Couche           | Technologies                     |
| ---------------- | -------------------------------- |
| Front-end        | Next.js 15, React 19, TypeScript |
| API              | Fastify 5, TypeScript            |
| Validation       | Zod                              |
| Base de données  | PostgreSQL, Prisma               |
| Authentification | JWT, cookies HTTP-only           |
| Intégrations     | HelloAsso, Google Drive, Brevo   |
| Tests            | Vitest                           |
| Déploiement      | Docker, Render, Neon             |

Le projet utilise un **monorepo npm workspaces** afin de séparer clairement l’interface web, l’API métier et les contrats partagés.

## Architecture

```text
Client web Next.js ─┐
                    ├── API REST /api/v1 ── PostgreSQL
Futur client mobile ┘          │
                               ├── HelloAsso
                               ├── Google Drive
                               └── Brevo
```

* `apps/web` contient l’interface Next.js et communique exclusivement avec l’API HTTP.
* `apps/api` contient les règles métier, l’authentification, la persistance et les intégrations externes.
* `packages/contracts` expose les DTO et schémas de validation partagés entre les différents clients.
* PostgreSQL n’est jamais accessible directement depuis un client.
* Les routes métier sont versionnées sous `/api/v1` afin de faciliter les évolutions futures de l’API.

Une documentation plus détaillée est disponible dans [`docs/architecture.md`](docs/architecture.md).

## Points techniques

Le projet met notamment en œuvre :

* une séparation explicite entre front-end, API et contrats partagés ;
* une API REST versionnée ;
* une validation centralisée des données avec Zod ;
* une authentification par JWT utilisable via cookie HTTP-only ou jeton Bearer ;
* une limitation du débit des requêtes et des limites sur les fichiers envoyés ;
* le masquage des informations sensibles dans les logs ;
* des en-têtes HTTP de sécurité ;
* une couche d’intégration dédiée pour HelloAsso, Google Drive et Brevo ;
* une synchronisation planifiée configurable ;
* un mode démonstration isolé des services externes ;
* des tests automatisés avec Vitest ;
* des images Docker distinctes pour le web et l’API.

## Structure du dépôt

```text
LaSportive/
├── apps/
│   ├── api/            # API Fastify, Prisma et intégrations
│   └── web/            # Application Next.js
├── packages/
│   └── contracts/      # DTO et schémas partagés
├── docs/               # Documentation technique
├── docker-compose.yml
├── render.yaml
└── package.json
```

## Démarrage en mode démonstration

### Prérequis

* Node.js 22 ou supérieur
* npm

Installer les dépendances :

```bash
npm install
```

Créer le fichier d’environnement à partir de l’exemple :

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Dans `.env`, définir :

```env
DEMO_MODE=true
```

Les identifiants de démonstration sont par défaut :

```text
Utilisateur : association
Mot de passe : demo-sportive
```

Ils peuvent être modifiés avec `DEMO_USERNAME` et `DEMO_PASSWORD`.

Lancer ensuite les applications :

```bash
npm run dev
```

L’interface est disponible sur `http://localhost:3000`.

En mode démonstration, aucune requête n’est envoyée vers HelloAsso, Google Drive ou Brevo.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
```

## Configuration de production

1. Créer les identifiants API HelloAsso et configurer l’accès Google Drive.
2. Générer le dérivé `scrypt` du mot de passe applicatif :

```bash
npm run password:hash -w @la-sportive/api -- "mot-de-passe"
```

3. Renseigner les secrets décrits dans `.env.example` dans le gestionnaire de secrets de l’hébergeur.
4. Déployer PostgreSQL, l’API et le web dans une région adaptée.
5. Exécuter les migrations puis le seed :

```bash
npm run db:migrate
npm run db:seed
```

6. Configurer la campagne et vérifier les mappings avant la première synchronisation réelle.

La synchronisation automatique utilise `SYNC_CRON` et s’exécute toutes les 15 minutes par défaut. Une synchronisation manuelle reste disponible dans l’interface.

Pour utiliser l’environnement sandbox HelloAsso, définir :

```env
HELLOASSO_ENVIRONMENT=sandbox
```

L’API utilise alors `api.helloasso-sandbox.com`.

## Déploiement sur Render

Le fichier [`render.yaml`](render.yaml) documente la configuration de référence.

Le déploiement prévu utilise deux services Docker indépendants dans la région de Francfort :

* `la-sportive-api` pour l’API Fastify ;
* `la-sportive-web` pour l’interface Next.js.

La base PostgreSQL peut être hébergée sur Neon, avec sa chaîne de connexion stockée dans `DATABASE_URL`.

1. Connecter le dépôt GitHub à Render et sélectionner la branche `main`.
2. Créer l’API avec `apps/api/Dockerfile`, le contexte Docker `.`, et le health check `/health`.
3. Configurer notamment `NODE_ENV`, `API_PORT`, `DATABASE_URL`, `APP_USERNAME`, `APP_PASSWORD_HASH`, `JWT_SECRET`, `SYNC_CRON`, ainsi que les variables HelloAsso, Brevo et Google Drive.
4. Créer le web avec `apps/web/Dockerfile` et renseigner `NEXT_PUBLIC_API_URL` avec l’URL publique de l’API suivie de `/api/v1`.
5. Configurer `WEB_ORIGIN` et `GOOGLE_OAUTH_REDIRECT_URL` avec les URLs réellement attribuées par Render.
6. Exécuter le seed une première fois avant la synchronisation réelle.

Les fichiers `.env` locaux ne doivent jamais être ajoutés au dépôt ou inclus dans les images de production. Les secrets doivent être renseignés uniquement via le gestionnaire de variables d’environnement de l’hébergeur.

## Licence

Ce projet est publié à des fins de consultation et de présentation. Son code n’est pas distribué sous licence open source.

**All Rights Reserved — Tous droits réservés.** Voir [`LICENSE`](LICENSE).
