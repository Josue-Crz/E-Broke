# e-Broke Backend

Free-items-only marketplace for SFSU students (AI for Social Good hackathon). Node.js + Express + PostgreSQL, with all AI on **DigitalOcean Gradient** serverless inference.

## DigitalOcean products used

| Product | Used for |
|---|---|
| **Gradient serverless inference** | Vision model for photo → listing JSON (`openai-gpt-5.6-luna`), embeddings for semantic search + wishlist matching (`gte-large-en-v1.5`, 1024-dim) |
| **Managed PostgreSQL** | Primary database with **pgvector** for embeddings (supported on managed PG 15+: `CREATE EXTENSION vector`) |
| **Spaces** | Photo storage (S3-compatible, public-read bucket + CDN) |
| **App Platform** | Deployment (see `.do/app.yaml`) |

## Local setup

Requires Node 18+, PostgreSQL with the pgvector extension available.

```bash
npm install
cp .env.example .env        # fill in your Gradient key + DATABASE_URL + SESSION_SECRET
createdb ebroke_dev
npm run migrate             # creates schema (enables pgvector)
npm run seed                # 3 demo users + 10 listings with real embeddings
npm start                   # or: npm run dev (watch mode)
```

Seed logins: `alice@sfsu.edu` / `marcus@sfsu.edu` / `priya@sfsu.edu`, password `password123` (already verified).

**Email verification in dev:** there's no email provider — the 6-digit code is printed to the server console and returned as `devVerificationCode` in the register response (non-production only).

## Quick test

```bash
# AI photo analysis (Abha's endpoint)
curl -X POST http://localhost:3000/listings/analyze-photo -F "photo=@/path/to/photo.jpg"

# Browse + semantic search
curl "http://localhost:3000/listings?category=furniture"
curl "http://localhost:3000/search?q=somewhere+to+sit"
```

## Endpoints

- **Auth**: `POST /auth/register` (@sfsu.edu only) · `POST /auth/verify-email` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`
- **Listings**: `GET /listings` (filters: `category`, `condition`, `neighborhood`, `free_today=true`; paginated) · `GET /listings/:id` · `POST /listings` · `PATCH /listings/:id` · `DELETE /listings/:id` (soft) · `POST /listings/:id/claim` (single-claimer) · `POST /listings/analyze-photo`
- **Search**: `GET /search?q=...` — Gradient embedding + pgvector cosine similarity, keyword-boosted
- **Saves**: `POST`/`DELETE /listings/:id/save` · `GET /me/saved`
- **Wishlist**: `POST`/`GET /wishlist-alerts` · `DELETE /wishlist-alerts/:id` — new listings above the similarity threshold trigger notifications
- **Messaging** (polling, no websockets): `GET`/`POST /conversations` · `GET`/`POST /conversations/:id/messages` · `GET /me/unread-count`
- **Misc**: `GET /me/listings` · `GET /notifications` · `POST /notifications/:id/read` · `POST /uploads/photo` (→ Spaces)

Errors are always `{ "error": { "code", "message" } }`. Posting, claiming, and messaging require a verified account. AI-calling endpoints are rate-limited (30 / 15 min per user).

**Free-only enforcement:** listing text with dollar amounts, payment apps (Venmo/Zelle/…), "OBO", or sale language is rejected with `422 FREE_ONLY_VIOLATION` (regex pass in `services/moderation.js`; a Gradient LLM second layer can slot in there).

## Deploying (App Platform)

1. Create a **Managed PostgreSQL** cluster (PG 15+), run `CREATE EXTENSION vector;`, set `DATABASE_URL`.
2. Create a **Spaces** bucket (public-read) + CDN, set the `SPACES_*` env vars.
3. Push to GitHub, create the app from `.do/app.yaml` (or point App Platform at the repo), set env vars as secrets.
4. Run `npm run migrate` against the production DB once.

## Notes for the team

- One embedding model everywhere (`EMBEDDING_MODEL`, default `gte-large-en-v1.5`). Changing it means re-embedding everything and matching the `vector(1024)` column dimension.
- Wishlist match threshold: `WISHLIST_MATCH_THRESHOLD` (default 0.65) — tune with real listings.
- The vision call for `/listings/analyze-photo` lives in `services/vision.js` (Abha's — prompt in the `LISTING_PROMPT` constant).
