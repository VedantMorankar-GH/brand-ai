# BrandGuard AI — Full-stack application

This project keeps the original React/Vite interface and adds an Express API, MongoDB persistence, real authentication, PDF guideline extraction and AI-powered brand review.

## Stack

- Frontend: React 18, Vite, React Router
- Backend: Node.js 20+, Express
- Database: MongoDB Atlas + Mongoose
- Authentication: JWT + bcrypt
- AI: OpenAI chat completions (`gpt-4o-mini` by default)
- Guideline ingestion: PDF text extraction (`pdf-parse`) and Cloudinary-backed asset storage

## 1. Prerequisites

Install Node.js 20 or newer and npm. Create a MongoDB Atlas database and an OpenAI API key. The API key belongs only in `server/.env`; never put it in a `VITE_` variable or commit it.

## 2. Configure the backend

```bash
cd server
cp .env.example .env
npm install
```

Edit `server/.env`:

- `MONGODB_URI`: your MongoDB Atlas connection string
- `JWT_SECRET`: a random secret of at least 32 characters
- `OPENAI_API_KEY`: your OpenAI API key (required for live AI scans)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: required for persistent brand asset uploads
- `ADMIN_EMAIL`: email for the first administrator
- `ADMIN_PASSWORD`: unique password of at least 12 characters
- `ADMIN_ORGANIZATION` and `DEFAULT_ORGANIZATION`: use the same organisation name (default: `BrandGuard`)
- `CLIENT_URL`: frontend origin (local default: `http://localhost:5173`)

Create the first administrator and start the API:

```bash
npm run seed
npm run dev
```

The API runs at `http://localhost:5000`. Verify `http://localhost:5000/api/health` reports `status: ok` and `database: connected`.

## 3. Configure and start the frontend

Open a second terminal at the project root (the folder containing this README):

```bash
cp .env.example .env
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. The root `.env` should contain:

```env
VITE_API_URL=http://localhost:5000/api
```

## 4. First login and team setup

1. Sign in using the administrator credentials configured in `server/.env`.
2. Open **User management** and create Creator, Reviewer and Legal accounts. Use a temporary password of at least 8 characters and share it securely.
3. Team members register or sign in using the same `DEFAULT_ORGANIZATION` value. Public registration can create Creator accounts only.
4. In **Brand Knowledge Base**, upload readable PDF guidelines and maintain approved facts and terminology.
5. Create a document in Creator Workspace, run an AI scan, and submit it for review.
6. Sign in with Reviewer and Legal accounts in separate browser profiles to test the full workflow.

## 5. Available functionality

- Server-side registration, login, JWT validation, password hashing and role checks.
- Admin-managed user creation, role changes and activation/deactivation.
- MongoDB organisation workspace snapshots for Creator documents, scans, submissions, threaded review comments, decisions, legal decisions, overrides, audit events, knowledge-base data, settings and notification read state.
- PDF upload with text extraction and indexing into the organisation's brand-rule collection; image/PDF asset uploads and deletion through Cloudinary.
- OpenAI-powered brand scanning. Relevant guideline/fact/terminology records are retrieved from the knowledge base and supplied as context to the model. Findings include severity, evidence snippets, explanations and suggestions.
- Reviewer and Legal workflow gates remain in the existing UI and are synchronized to the shared organisation workspace.

## 6. Verification

At the project root:

```bash
npm run check
npm run build
```

`npm run check` runs the included workflow and integration checks. The build command verifies the production Vite bundle. Also verify the backend health endpoint and run a real scan with an OpenAI key before deploying.

## 7. Deployment notes

Deploy the frontend and backend as separate services. Set `VITE_API_URL` to the deployed API URL at frontend build time. On the API service configure `MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`, `CLIENT_URL`, `ADMIN_ORGANIZATION` and `DEFAULT_ORGANIZATION`. Use HTTPS, restrict MongoDB network access, configure database backups, and never commit either `.env` file.

## Important production considerations

This is a complete integration foundation for the supplied prototype, but a public production launch still needs organisation invitation/verification, password reset and email delivery, malware scanning for uploads, stronger audit immutability, automated integration tests against a real MongoDB instance, rate limits on expensive AI routes, monitoring, backups and a privacy/security review. AI findings are suggestions and must be reviewed by a human.
