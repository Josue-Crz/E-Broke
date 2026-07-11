# e-Broke Frontend

The SFSU-only, free-item exchange frontend. Built with Vite, React, and TypeScript.

## Local development

Start the PostgreSQL/pgvector container and backend first, following the root `AGENTS.md`. The backend must be available at the URL configured below.

```bash
cp .env.example .env
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173). Set `VITE_API_URL` in `.env` when the backend runs somewhere other than `http://localhost:3000`.

Demo accounts use the password `password123`:

- `alice@sfsu.edu`
- `marcus@sfsu.edu`
- `priya@sfsu.edu`

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Implemented flows

- SFSU registration, development-code email verification, login, and logout
- Browse filters, pagination, semantic search, saves, and wish alerts
- Listing detail, claim, owner messaging, create/edit/delete, and AI photo suggestions
- Graceful local fallback when DigitalOcean Spaces is not configured
- My Listings, saved items, notifications, and polling-based conversations

Every API request includes the session cookie through `credentials: 'include'`. The backend URL comes exclusively from `VITE_API_URL`; no API URL is embedded in the application source.
