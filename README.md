# e-Broke

**Good stuff. Zero dollars. Gators helping Gators.**

e-Broke is a free-item exchange for San Francisco State University students. It keeps furniture and other useful goods out of landfills while making them more accessible to the campus community.

The marketplace is intentionally free-only: there is no price field, and listings that contain sales language or payment requests are rejected.

## The problem we are solving

Giving away a useful item should be easier than throwing it away. e-Broke focuses on four barriers that make student-to-student reuse harder than it needs to be:

- **Too much effort to post an item.** Students who want to give something away may not have time to write and categorize a listing. With one photo, e-Broke's AI assistant drafts the title, description, category, and condition for the giver to review.
- **Pickup and transportation friction.** Getting bulky or inconvenient items across San Francisco can be difficult for students. Campus-focused discovery, pickup-area details, and direct messaging help students find practical nearby exchanges and coordinate the handoff before traveling.
- **Trust between strangers.** General marketplaces can make it hard to know who is on the other side of an exchange. Requiring an `@sfsu.edu` email keeps participation within the SFSU community and gives both givers and recipients a more reputable starting point.
- **The cost of disposing of still-useful goods.** Universities and nonprofits already invest in waste reduction and reuse programs, but moving every usable item through an institutional process takes time, storage, transportation, and money. e-Broke complements those existing efforts with a lightweight student-to-student distribution layer, helping redirect items before they enter disposal workflows and potentially reducing institutional waste-handling costs.

## Why this matters

> **640 pounds per student, per year**

The Connecticut Department of Energy and Environmental Protection's college-recycling resource page, citing Dump and Run, reports that the average college student produces 640 pounds of solid waste each year—including 320 pounds of paper and 500 disposable cups. It also notes that campus waste rises significantly at the end of the school year, when reusable clothing, food, furniture, and household goods are often discarded.

This is not a Connecticut-wide total; it is an annual estimate for one college student. The government page was [last updated in February 2020](https://portal.ct.gov/deep/reduce-reuse-recycle/schools/college-and-university-recycling).

> **Up to 50 additional tons during end-of-year move-out**

The same resource highlights how sharply campus waste can increase when students move out. In 1993, Tufts University recorded as much as 50 tons above its reported average of 180 tons. In response to spikes like this, campuses organize recovery programs for reusable furniture and household goods, along with clothing and food.

e-Broke turns that same recovery principle into an always-available student-to-student channel. By making redistribution faster, more local, and easier to trust throughout the year—and especially during move-out—it can help useful items find new homes before they enter institutional collection and disposal workflows.

## Features

- SFSU-only accounts with `@sfsu.edu` email verification
- Responsive browsing, filters, pagination, and listing management
- AI-assisted photo-to-listing drafts
- Semantic search powered by vector embeddings
- Saved listings and semantic wishlist alerts
- Atomic, first-come-first-served item claims
- Notifications and polling-based conversations
- Free-only text moderation
- DigitalOcean Spaces photo uploads when configured

## Architecture

```mermaid
flowchart LR
    User[Browser] --> Frontend["React + Vite<br/>localhost:5173"]
    Frontend -->|Session cookie + JSON| API["Express API<br/>localhost:3000"]
    API --> DB[(PostgreSQL + pgvector)]
    API --> Gradient["DigitalOcean Gradient<br/>Vision + embeddings"]
    API -. Optional .-> Spaces[DigitalOcean Spaces]
```

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, custom CSS |
| Backend | Node.js, Express 5, Zod, session-cookie authentication |
| Database | PostgreSQL 17 with pgvector |
| AI | DigitalOcean Gradient-compatible vision and embedding APIs |
| Storage | DigitalOcean Spaces, optional for local development |
| Deployment | DigitalOcean App Platform backend template |

## Quick start

### Prerequisites

- Node.js 20.11 or newer; Node.js 22 is recommended
- npm
- Docker, recommended for PostgreSQL and pgvector
- A DigitalOcean Gradient model-access key for semantic and AI features

There is no root `package.json`. Run npm commands inside `backend/` or `frontend/` as shown below.

### 1. Start PostgreSQL and pgvector

For a new local database, run this once from any directory:

```bash
docker run -d \
  --name ebroke-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=ebroke_dev \
  pgvector/pgvector:pg17
```

For later sessions, restart the existing container instead:

```bash
docker start ebroke-pg
```

The container creates `ebroke_dev` automatically. Do not also run bare `createdb ebroke_dev`; that command may connect to a different PostgreSQL installation using your operating-system username.

### 2. Configure and start the backend

Install dependencies:

```bash
cd backend
npm ci
```

Create `backend/.env` manually with the following development configuration:

```dotenv
DATABASE_URL=postgres://postgres:dev@localhost:5432/ebroke_dev
SESSION_SECRET=replace-with-a-long-random-string
CORS_ORIGIN=http://localhost:5173

VISION_API_KEY=replace-with-your-gradient-access-key
VISION_BASE_URL=https://inference.do-ai.run/v1
VISION_MODEL=openai-gpt-5.6-luna
EMBEDDING_MODEL=gte-large-en-v1.5
```

You can generate a session secret with `openssl rand -hex 32`, then paste the result into `.env`. Never commit this file or share its secrets.

Create the schema and start the API:

```bash
npm run migrate
npm run dev
```

`npm run migrate` is safe to repeat after the migration has been applied.

To populate a brand-new development database with demo data, stop the API and run:

```bash
npm run seed
npm run dev
```

> [!WARNING]
> `npm run seed` deletes all existing application data before recreating three demo users, ten listings, and one wishlist alert. A working Gradient key is needed for searchable embeddings.

Verify the API from another terminal:

```bash
curl http://localhost:3000/listings
```

The API root at `http://localhost:3000/` intentionally returns `404 NOT_FOUND`; `/listings` is the health check.

### 3. Configure and start the frontend

In a second terminal:

```bash
cd frontend
npm ci
# Only run this when frontend/.env does not already exist.
cp .env.example .env
npm run dev
```

The frontend environment must contain:

```dotenv
VITE_API_URL=http://localhost:3000
```

Open [http://localhost:5173](http://localhost:5173).

### Demo accounts

All seeded accounts use the password `password123` and are already verified:

- `alice@sfsu.edu`
- `marcus@sfsu.edu`
- `priya@sfsu.edu`

## Email verification in development

New accounts receive a random six-digit code that expires after 15 minutes. There is no email provider or universal verification code in local development. Instead, the code is:

- returned as `devVerificationCode` by `POST /auth/register` outside production;
- displayed and prefilled by the frontend; and
- printed in the backend terminal.

There is currently no resend-code endpoint, so complete verification before the code expires.

## Common questions

### Is every item really free?

Yes. e-Broke has no price field. Listings containing dollar amounts, payment apps, “OBO,” or other sales language are rejected. The platform is for giving items away, not selling them.

### Who can use e-Broke?

Anyone can browse active listings, but registration requires an `@sfsu.edu` email. A verified account is required to post, claim, or message about an item.

### Is there a universal email-verification code?

No. Every new development account receives its own random six-digit code, valid for 15 minutes. Locally, the code appears in the registration response, on the verification screen, and in the backend terminal.

### How does the photo-to-listing feature work?

The giver selects a photo, and the AI assistant suggests a title, description, category, and condition. The giver must review the suggestions before posting. Unsafe or unidentifiable images are flagged instead of being applied automatically.

### Does e-Broke provide transportation or delivery?

No. e-Broke helps students discover nearby items and coordinate a handoff through pickup-area details and direct messaging. Givers and recipients remain responsible for choosing a practical, safe meeting arrangement.

### What happens when two students claim the same item?

Claims are first come, first served. The backend changes the listing atomically, so only the first valid claim succeeds; later attempts receive an already-claimed response.

### Does an SFSU email guarantee that a user is trustworthy?

No verification system can guarantee another person's behavior. The university email requirement creates a more accountable campus starting point, but students should still protect personal information and meet in a safe, appropriate location.

### Is e-Broke replacing university or nonprofit reuse programs?

No. It complements them. e-Broke provides a lightweight student-to-student distribution channel that can redirect useful items before they require institutional collection, storage, transportation, or disposal.

### Where are uploaded photos stored?

Production uploads can use DigitalOcean Spaces. When Spaces is not configured locally, the frontend supports a hosted image URL or a default image instead of pretending the upload succeeded.

### Why does the backend root return `NOT_FOUND`?

The API does not define `GET /` and has no `/api` prefix. Use `GET /listings` to confirm that the backend is running, and use the documented HTTP method for each endpoint.

## API overview

The API has no `/api` prefix. Authentication uses an HTTP-only session cookie, not a JWT; every frontend request sends `credentials: 'include'`.

| Area | Endpoints |
|---|---|
| Authentication | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Listings | `GET/POST /listings`, `GET/PATCH/DELETE /listings/:id`, `POST /listings/:id/claim` |
| AI assistance | `POST /listings/analyze-photo`, `GET /search?q=...` |
| Saves and alerts | `POST/DELETE /listings/:id/save`, `GET /me/saved`, `GET/POST /wishlist-alerts` |
| Messaging | `GET/POST /conversations`, `GET/POST /conversations/:id/messages` |
| Account | `GET /me/listings`, `GET /me/unread-count`, `GET /notifications` |
| Photos | `POST /uploads/photo` |

Most errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation"
  }
}
```

See [backend/README.md](backend/README.md) for the extended endpoint and deployment notes.

## Optional DigitalOcean Spaces configuration

Add these backend variables to enable uploaded-photo persistence:

```dotenv
SPACES_KEY=replace-me
SPACES_SECRET=replace-me
SPACES_REGION=sfo3
SPACES_BUCKET=your-bucket-name
SPACES_CDN_BASE_URL=https://your-bucket.sfo3.cdn.digitaloceanspaces.com
```

Without them, `POST /uploads/photo` returns `503 SPACES_NOT_CONFIGURED`. The frontend handles this locally by allowing a hosted photo URL or a default image.

## Useful commands

Run these from their respective directories:

| Directory | Command | Purpose |
|---|---|---|
| `backend/` | `npm run dev` | Start the API with file watching |
| `backend/` | `npm start` | Start the API without watching |
| `backend/` | `npm run migrate` | Apply pending migrations |
| `backend/` | `npm run seed` | **Destructively** recreate demo data |
| `frontend/` | `npm run dev` | Start the Vite development server |
| `frontend/` | `npm run lint` | Run ESLint |
| `frontend/` | `npm test` | Run the Vitest suite once |
| `frontend/` | `npm run build` | Type-check and build for production |

Frontend quality check:

```bash
cd frontend
npm run lint
npm test
npm run build
```

## Troubleshooting

### `FATAL: role "<username>" does not exist`

A bare `createdb` command reached a native PostgreSQL instance and used your operating-system username. Use the Docker container above and confirm that `DATABASE_URL` points to `postgres@localhost:5432`.

### `404 { "code": "NOT_FOUND" }`

The backend is reachable, but the method or path is not registered. `GET /` is intentionally absent, auth actions such as `/auth/login` require `POST`, and there is no `/api` prefix. Test with `GET /listings`.

### Login succeeds but authenticated requests return `401`

Confirm that the frontend uses the exact backend URL in `VITE_API_URL`, all requests include credentials, and `CORS_ORIGIN` exactly matches the frontend origin. If Vite changes to another port because `5173` is busy, update `CORS_ORIGIN` or free that port.

### AI requests return `502` or search has no results

Check `VISION_API_KEY`, `VISION_BASE_URL`, and the configured model names. Seeded listings need non-null embeddings for semantic search.

### Photo uploads return `503`

Configure the `SPACES_*` variables or continue locally with a hosted image URL/default image.

## Project structure

```text
E-Broke/
├── backend/             # Express API, migrations, services, and seed script
├── frontend/            # React application, tests, and styles
├── AGENTS.md            # Repository-specific development guidance
└── LICENSE
```

## Deployment

The backend includes a DigitalOcean App Platform template at `backend/.do/app.yaml`. Before using it:

1. replace its placeholder GitHub repository;
2. provision PostgreSQL with pgvector enabled;
3. configure secrets in App Platform rather than committing them;
4. run the migration once against the production database; and
5. set `CORS_ORIGIN` to the deployed frontend origin.

For session cookies to work in production, deploy the frontend and API on compatible same-site domains or review the backend cookie policy before using separate sites.

## License

This project is available under the [MIT License](LICENSE).
