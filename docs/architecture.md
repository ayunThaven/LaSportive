# Architecture évolutive

Le dépôt est un monorepo de développement, mais les composants sont des applications déployables indépendamment.

```text
Client web Next.js ─┐
                    ├── API REST /api/v1 ── PostgreSQL
Futur client mobile ┘          │
                               ├── HelloAsso (lecture seule)
                               ├── Google Drive
                               └── SMTP
```

## Frontières

- `apps/web` contient uniquement l’interface et consomme l’API HTTP.
- `apps/api` possède les règles métier, l’authentification, la persistance et les intégrations.
- `packages/contracts` expose les DTO et schémas de validation partagés. Un client mobile peut générer ou réutiliser ces types sans importer le serveur.
- PostgreSQL n’est jamais accessible directement depuis un client.

L’API accepte la session HTTP-only du client web et un jeton Bearer retourné à la connexion pour un futur client natif. Toutes les routes métier sont préfixées par `/api/v1` afin de permettre une évolution compatible.

## Déploiement

Les images `apps/api/Dockerfile` et `apps/web/Dockerfile` sont indépendantes. En production, utiliser deux services et un PostgreSQL managé dans une région européenne. Le service API doit rester à une seule réplique tant que le verrou distribué du planificateur de synchronisation n’est pas activé.
