# CLAUDE.md — e-Broke Frontend

You are building the frontend for **e-Broke**, a free-items-only marketplace for SFSU students (hackathon: AI for Social Good, DigitalOcean-sponsored). The backend is **done and lives in `../backend`** — do not modify backend code; if something seems broken or missing there, flag it to Abha instead.

## Step 0 — Get the backend running on this laptop (do this first)

The backend is Node/Express + PostgreSQL (with the pgvector extension) + DigitalOcean Gradient for AI. Everything runs locally except the AI calls.

### 1. PostgreSQL + pgvector

Pick ONE:

**Option A — Homebrew (macOS):**
```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
createdb ebroke_dev
```

**Option B — Docker (any OS):**
```bash
docker run -d --name ebroke-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=ebroke_dev pgvector/pgvector:pg17
```

The migration runs `CREATE EXTENSION vector` itself — you just need pgvector *available*, which both options give you.

### 2. Backend env + run

```bash
cd ../backend
npm install
cp .env.example .env
```

Edit `.env`:
- `VISION_API_KEY` — **get this from Abha** (DigitalOcean Gradient model access key). Never commit it.
- `DATABASE_URL` — Homebrew: `postgres://<your-mac-username>@localhost:5432/ebroke_dev` · Docker: `postgres://postgres:dev@localhost:5432/ebroke_dev`
- `SESSION_SECRET` — any long random string
- `CORS_ORIGIN` — the frontend dev URL, e.g. `http://localhost:5173` (that's also the default)

Then:
```bash
npm run migrate   # creates schema
npm run seed      # 3 demo users + 10 listings with real AI embeddings (needs VISION_API_KEY)
npm run dev       # backend on http://localhost:3000
```

Sanity check: `curl http://localhost:3000/listings` should return 10 seeded listings.

**Seeded demo logins** (already email-verified): `alice@sfsu.edu`, `marcus@sfsu.edu`, `priya@sfsu.edu` — password `password123`.

### 3. Ports

Backend owns **3000**. Run the frontend on any other port (Vite's 5173 is pre-approved by CORS). If you use Next.js (defaults to 3000), start it with `-p 5173` or set `CORS_ORIGIN` in the backend `.env` to whatever port you use.

## How to talk to the backend

### Auth is session-cookie based — this is the #1 integration gotcha

There are no JWTs and no `Authorization` headers. The backend sets an httpOnly session cookie on register/login, and every request must send it:

```js
// fetch — EVERY call, not just login:
fetch('http://localhost:3000/listings', { credentials: 'include' })

// axios:
axios.defaults.withCredentials = true;
```

If `GET /auth/me` returns 401 right after logging in, you forgot `credentials: 'include'` somewhere (or the CORS origin doesn't match your dev URL exactly).

### Error shape — uniform everywhere

```json
{ "error": { "code": "SOME_CODE", "message": "Human-readable message" } }
```

Codes you should handle in the UI: `UNAUTHENTICATED` (401 → redirect to login), `EMAIL_NOT_VERIFIED` (403 → show verify screen), `FREE_ONLY_VIOLATION` (422 → show `message` on the listing form; it explains what tripped it, e.g. a dollar amount), `ALREADY_CLAIMED` (409), `RATE_LIMITED` (429), `AI_UNAVAILABLE` (502 → "try again" toast), `VALIDATION_ERROR` (400).

### Registration / verification flow

1. `POST /auth/register` `{ name, email, password }` — email **must end in `@sfsu.edu`** (backend enforces). Response includes the user AND (dev mode only) `devVerificationCode` — there's no real email sending locally, so show/log that code and feed it straight into the verify screen.
2. `POST /auth/verify-email` `{ email, code }` — until this succeeds the user can browse but gets 403 on posting/claiming/messaging.
3. `POST /auth/login` `{ email, password }` · `POST /auth/logout` · `GET /auth/me` → `{ user: { id, name, email, avatarUrl, verified, createdAt } }`

## Endpoint reference (all JSON camelCase)

### Listings
- `GET /listings?category=&condition=&neighborhood=&free_today=true&page=1&limit=20` → `{ listings: [...], page, limit, total }`
- `GET /listings/:id` → `{ listing }` — listing shape: `{ id, userId, title, description, category, condition, neighborhood, photoUrls[], status, createdAt, owner: { id, name, avatarUrl } }`
- `POST /listings` `{ title, description, category, condition, neighborhood?, photoUrls? }` (verified only) → 201 `{ listing }`. **There is no price field anywhere — the app is free-only by design.** Text that looks like selling ($20, Venmo, OBO…) is rejected with 422.
- `PATCH /listings/:id` (owner) · `DELETE /listings/:id` (owner, soft-delete)
- `POST /listings/:id/claim` (verified, not owner) — single-claimer: first wins, listing flips to `claimed`, owner gets a notification. Second claimer gets 409.
- `POST /listings/analyze-photo` — multipart, field name **`photo`** → AI-generated `{ title, description, category, condition, isFree, flagged, flagReason }` for pre-filling the create-listing form. If `flagged` is true, show `flagReason` and don't pre-fill. ⚠️ This endpoint currently returns its own category/condition spellings (`like-new` vs the DB's `like_new`, and some categories differ) — map them or treat them as suggestions the user confirms in the form. Abha owns the fix.

**Enums (use exactly these in forms/filters):**
- `category`: `dorm_essentials | textbooks | electronics | furniture | food | other`
- `condition`: `like_new | good | fair`
- `status`: `active | claimed | removed`

### Search
- `GET /search?q=...` → `{ query, results: [listing + score] }` — semantic (AI embeddings), so "somewhere to sit" finds the futon. **Debounce this** (submit on Enter, not per keystroke): AI endpoints are rate-limited to 30 requests / 15 min per user, and each call costs an embedding.

### Saves & wishlist
- `POST /listings/:id/save` · `DELETE /listings/:id/save` · `GET /me/saved` → `{ listings }`
- `POST /wishlist-alerts` `{ queryText }` · `GET /wishlist-alerts` → `{ alerts }` · `DELETE /wishlist-alerts/:id` — when a matching listing is posted, that user gets a `wishlist_match` notification.

### Messaging (polling, no websockets)
- `GET /conversations` → `{ conversations: [{ id, listing: { id, title, photoUrl, status }, otherUser, lastMessage, lastMessageAt, unreadCount, createdAt }] }`
- `POST /conversations` `{ listingId, message }` → `{ conversationId, message }` (reuses the existing conversation if one exists)
- `GET /conversations/:id/messages` → `{ messages }` — **fetching also marks them read**, so refresh the unread badge after
- `POST /conversations/:id/messages` `{ body }`
- `GET /me/unread-count` → `{ unreadCount }` — poll this every ~5–10s for the navbar badge; poll the open conversation's messages every ~3–5s

### Misc
- `GET /me/listings` → my active + claimed listings ("My Listings" page)
- `GET /notifications` → `{ notifications: [{ id, type, payload, readAt, createdAt }] }` — types: `wishlist_match`, `listing_claimed`; `payload` has `listingId`/`listingTitle` for linking
- `POST /notifications/:id/read`
- `POST /uploads/photo` — multipart field `photo` → `{ url }` for `photoUrls`. Locally this returns **503 SPACES_NOT_CONFIGURED** until DigitalOcean Spaces creds exist; for local dev just use placeholder image URLs (seed data uses `https://picsum.photos/seed/<x>/600/400`).

## Ground rules

- Frontend code lives in this `frontend/` folder. Suggested: Vite + React, but your call.
- Never hardcode the backend URL — use an env var (e.g. `VITE_API_URL=http://localhost:3000`) so it can point at the deployed App Platform URL later.
- Never display or invent a price field. Free-only is the whole product.
- If an AI-powered call returns 502, show a friendly retry state — it usually means the Gradient key is missing/rate-limited, not a bug in your code.
