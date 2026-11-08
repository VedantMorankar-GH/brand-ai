# BrandGuard AI — Complete Integrated Website (Parts 1–5)

BrandGuard AI is a single frontend-only React application demonstrating an enterprise brand-governance workflow. Parts 1–5 are integrated into one Vite application and share the same browser-side document, knowledge-base, review, audit, notification and analytics records.

## 1. Technology stack

- React 18 and React DOM
- Vite 6
- React Router DOM 6
- Framer Motion
- Three.js, React Three Fiber and Drei
- Recharts
- Lucide React
- Browser LocalStorage for demo persistence

No backend, external AI model, CMS, identity provider or production database is connected.

## 2. Features by development part

### Part 1 — Foundation
- Dark futuristic landing page with lazy-loaded 3D shield, Suspense fallback and WebGL error fallback
- Demo authentication and four role dashboards
- Shared application shell, role-based navigation and responsive layout

### Part 2 — Brand Knowledge Base
- Brand Bible PDF metadata library
- Approved facts
- Preferred, banned and alias terminology
- Brand asset library
- Brand identity colours and typography
- Knowledge-base version history and activity
- Shared knowledge-base data consumed by the deterministic scanner

### Part 3 — Creator Workspace
- Creator document library and rich-text editor
- Local deterministic scanner
- Unsupported-claim, fact, terminology, tone, messaging, accessibility and visual issue checks
- Suggested corrections, issue resolution/dismissal and compliance score
- Document save, version checkpoints and submission

### Part 4 — Reviewer and Legal workflow
- Review queue and document review
- General and anchored comments, replies, edit, resolve and reopen
- Approve, request changes and send to Legal
- Reasoned Critical issue overrides
- Legal decisions and return to Reviewer
- Creator revision and resubmission as a new version
- Approved document library and separate manual publishing action
- Revision history and audit trail

### Part 5 — Governance operations
- Admin governance analytics driven by the shared document, submission, issue, comment, override and audit records
- Executive metrics, trend charts, issue breakdowns, violated-rule ranking, override review, evidence-based guideline signals and team performance
- Date, department, Creator, Reviewer, severity and document-status filters
- Admin user directory: add, edit, role change, activate/deactivate, search, filter and sort
- Frontend route guards for role-restricted pages and a last-active-Admin safeguard
- Event-derived notification center, unread state, mark-read and mark-all-read
- Profile, organisation, appearance, notification and security/privacy settings
- Global search across documents, submissions, Brand Bible records, approved facts, terminology, assets, users and review comments

## 3. Demo credentials

| Role | Email | Password |
|---|---|---|
| Creator | `creator@brandguard.ai` | `creator123` |
| Reviewer | `reviewer@brandguard.ai` | `reviewer123` |
| Admin | `admin@brandguard.ai` | `admin123` |
| Legal | `legal@brandguard.ai` | `legal123` |

Admin-created users are stored in LocalStorage and can sign in with the demo password entered when their account is created.

## 4. Main routes

| Route | Access |
|---|---|
| `/` | Public landing page |
| `/login`, `/register`, `/forgot-password` | Public authentication screens |
| `/app` | All authenticated demo roles |
| `/app/knowledge/:section?` | Role-limited Knowledge Base sections |
| `/app/my-documents`, `/app/create/:documentId?`, `/app/creator-status` | Creator |
| `/app/queue`, `/app/review/:submissionId`, `/app/approved`, `/app/changes-requested`, `/app/revisions` | Reviewer (review route also available to Legal where appropriate) |
| `/app/legal-reviews`, `/app/claims` | Legal |
| `/app/analytics`, `/app/users` | Admin |
| `/app/audit` | Reviewer, Legal, Admin |
| `/app/notifications`, `/app/settings` | All authenticated roles |

Role restrictions are checked by React route guards and by the existing page-level workflow checks. These are frontend controls only and are not a substitute for server-side authorization.

## 5. End-to-end workflow

1. Admin maintains the Brand Knowledge Base and approved brand reference data.
2. Creator drafts content and runs the local scanner.
3. Critical unresolved issues block normal submission unless the workflow's permitted reasoned override path is used.
4. Creator submits a document to the Reviewer queue.
5. Reviewer comments, requests changes, escalates to Legal or approves.
6. Creator revises and resubmits; a new submission/version is created.
7. Legal records a decision for escalated documents. Legal approval returns the item to Reviewer; it is not final publication approval.
8. Reviewer approves the document.
9. Reviewer manually marks the approved document as published.
10. Workflow actions are recorded in the local audit history and relevant notifications. Analytics reads the same stored records.

## 6. LocalStorage data contracts

| Key | Purpose |
|---|---|
| `bg_session` | Current simulated browser session |
| `bg_users_v1` | Demo user directory and demo credentials |
| `bg_settings_v1` | Profile-adjacent workspace, appearance and notification preferences |
| `bg_notification_reads_v1` | Read notification IDs |
| `bg_knowledge_base_v1` | Brand Bible metadata, facts, terminology, assets and identity data |
| `bg_knowledge_versions_v1` | Knowledge Base version snapshots |
| `bg_creator_documents_v1` | Canonical Creator document records and versions |
| `bg_creator_scans_v1` | Deterministic scan history |
| `bg_creator_submissions_v1` | Canonical submissions and workflow state |
| `bg_review_comments_v1` | Review comments, anchors and replies |
| `bg_review_decisions_v1` | Reviewer decisions |
| `bg_legal_decisions_v1` | Legal decisions |
| `bg_critical_overrides_v1` | Reasoned Critical issue overrides |
| `bg_audit_events_v1` | Audit events generated by application actions |

The Part 5 data and analytics helpers are in `src/data/governanceStore.js`. Reviewer and Legal workflow operations remain in `src/data/reviewStore.js`; Creator document records remain in `src/data/creatorStore.js`.

## 7. Installation and run

Requirements: Node.js 18+ and npm.

```bash
cd brandguard-part1
npm install
npm run check
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## 8. Tests included

`npm run check` executes four Node-based regression suites:

- `scripts/check.mjs` — project structure, local imports, routes and Part 1–3 integration contracts
- `scripts/check-creator.mjs` — deterministic scanner, knowledge-base references, Creator document operations and submission
- `scripts/check-review-workflow.mjs` — Reviewer, Legal, override, version, publishing and audit workflow
- `scripts/check-part5.mjs` — user CRUD, role/last-Admin guard, settings persistence, shared analytics records, global search, event-derived notifications and read state

A JavaScript/JSX syntax parse was also run against all source JS/JSX modules during this delivery. A production Vite build and browser-based end-to-end test could not be run in the build environment because npm dependency installation could not reach the npm registry; `vite` was therefore not available locally. Run `npm install` and `npm run build` in a network-enabled environment before treating the website as production-build verified.

## 9. Final engineering audit status (4 November 2026)

The following issues were found during the final source/data-flow audit and corrected:

- User updates now reject duplicate email addresses (case-insensitive).
- The last active Admin cannot be demoted to another role or deactivated.
- Global search destinations now respect the current role; non-Admin users do not receive links to the Admin user directory.
- Notification links route to pages available to the signed-in role rather than sending Admin users to Reviewer-only pages.
- The Creator scan animation now has a WebGL error fallback and respects the reduced-motion preference.

Automated checks executed from a fresh extraction of the final ZIP:

- `npm run check` — PASS (four included regression suites).
- `node --check` — PASS for the non-JSX data/store modules checked.
- `npm install` — BLOCKED: npm registry DNS lookup failed with `EAI_AGAIN registry.npmjs.org`.
- `npm run build` — NOT RUN SUCCESSFULLY: Vite is not installed because dependency installation was blocked (`vite: not found`).
- `npm run dev` — NOT RUN SUCCESSFULLY for the same reason.
- Browser-based end-to-end interaction testing — NOT PERFORMED; the Vite app could not be started in this environment.

A `package-lock.json` is not included. The dependency tree could not be resolved without registry access, and a fabricated lockfile would be misleading. Run `npm install` after extraction in a network-enabled environment; npm will create the lockfile from the declared `package.json` dependencies.

These results mean the included automated logic checks pass, but this ZIP is **not yet production-build or browser-E2E verified**. Do not represent it as such until the build and manual browser checks have been completed locally.

## 10. Important files

```text
brandguard-part1/
  index.html
  package.json
  vite.config.js
  README.md
  scripts/
    check.mjs
    check-creator.mjs
    check-review-workflow.mjs
    check-part5.mjs
  src/
    App.jsx
    main.jsx
    components/
      common/Brand.jsx
      landing/LandingPage.jsx
      layout/AppLayout.jsx
      three/ShieldScene.jsx
    context/AuthContext.jsx
    data/
      mockData.js
      knowledgeBaseStore.js
      creatorStore.js
      brandScanner.js
      reviewStore.js
      governanceStore.js
    pages/
      AuthPages.jsx
      DashboardPages.jsx
      KnowledgeBasePage.jsx
      CreatorWorkspacePage.jsx
      ReviewerWorkspacePage.jsx
      Part5Pages.jsx
    styles/
      variables.css
      global.css
```

## 11. Simulations and known limitations

This is a frontend demonstration, not a production SaaS service:

- Authentication is simulated. Passwords and session state are stored in browser LocalStorage.
- Role restrictions are enforced in the frontend only; users can tamper with browser state. Production authorization must be enforced by a backend.
- LocalStorage is not a secure database, has browser/device scope, is not synchronized across users and can be cleared or modified.
- Audit history is append-only through the UI but is not cryptographically protected or tamper-proof.
- AI scanning is deterministic local rule logic, not a live AI model. Compliance scores are illustrative rule-based outputs, not validated accuracy measures or legal advice.
- Brand Bible PDF handling stores document metadata and simulates indexing; it does not extract or parse the PDF body text.
- Brand asset previews and visual checks are limited; image compliance is heuristic and does not replace computer-vision validation.
- Notification records are derived from recorded local audit events, not push notifications or email delivery.
- Publishing is a local status change only. No CMS, social platform or production publishing endpoint is connected.
- Organization logo and profile image binaries are not uploaded or persisted by this demo; profile initials and logo filename metadata are used.
- No server-side encryption, tenant isolation, secure session expiry, rate limiting or backend audit controls are provided.

## 12. Dependency lockfile note

The supplied Part 4 ZIP did not contain a `package-lock.json`. An attempt to generate one during Part 5 failed because the environment could not reach `registry.npmjs.org` and the required package metadata was not cached. No fabricated lockfile has been included. `npm install` will generate a valid lockfile when run in a network-enabled environment.
