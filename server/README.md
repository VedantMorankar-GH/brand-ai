# BrandGuard AI API

Express + MongoDB API for the existing React/Vite application. It provides JWT authentication, server-enforced roles, admin user management, organisation workspace persistence, PDF guideline ingestion and OpenAI-powered brand scanning.

## Setup

```bash
cp .env.example .env
npm install
```

A ready-to-edit `server/.env` is included for local development. It points to `mongodb://127.0.0.1:27017/brandguard` and contains a generated development JWT secret. This does **not** install or start MongoDB for you: install and start MongoDB Community Server first, or replace `MONGODB_URI` with your MongoDB Atlas connection string. Never commit or share your `.env` file.

Before using the seed command, change `ADMIN_PASSWORD` to a unique password of at least 12 characters. Add `OPENAI_API_KEY` for live AI scanning; Cloudinary credentials are only needed for persistent asset uploads. Then:

```bash
npm run seed
npm run dev
```

The API listens on `http://localhost:5000`. Check `GET /api/health`.

## API

- `POST /api/auth/register` — Creator registration only
- `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/logout`
- `GET/PUT /api/workspace` — authenticated organisation workspace persistence
- `GET /api/dashboard`
- `GET/POST/PATCH/DELETE /api/knowledge` — Admin-managed brand rules
- `POST /api/knowledge/upload` — Admin PDF extraction and indexing
- `POST /api/assets/upload`, `DELETE /api/assets/:id` — Cloudinary-backed brand asset storage
- `GET/POST /api/documents`, `GET/PATCH/DELETE /api/documents/:id`
- `POST /api/scan` — OpenAI brand scan using retrieved active guidelines, facts and terminology
- `POST /api/documents/:id/submit`, `GET /api/submissions`
- `PATCH /api/submissions/:id/decision`
- `GET /api/audit`
- `GET/POST /api/users`, `PATCH /api/users/:id` — Admin-only user management

Protected routes require `Authorization: Bearer <token>`.

## AI and retrieval

The scan service retrieves relevant guideline records, approved facts and terminology from the organisation's knowledge base using text relevance scoring, then sends only the most relevant context with the draft to the configured OpenAI model. If `OPENAI_API_KEY` is missing, scans fail with a clear configuration error rather than returning fake AI results.

## Notes

The frontend's synchronous legacy stores are retained to avoid rewriting the team's existing UI. An authenticated workspace bridge hydrates and synchronizes those workflow records to MongoDB for all users in the same organisation. User directory records are not included in that snapshot; they are managed directly through the protected user API. Do not add user passwords or tokens to workspace data.


## Registration security

Public self-registration is enabled without an invitation code. Set `REGISTRATION_ORGANIZATION` to the workspace slug (lowercase, e.g. `brandguard`). New registrations always receive the Creator role; Admin/Reviewer/Legal accounts must be provisioned by an Admin or the seed process. Because registration is open, anyone who can reach the API can create a Creator account; restrict access at the deployment/network level for private workspaces.

The API normalizes legacy user organization names to lowercase at startup.
