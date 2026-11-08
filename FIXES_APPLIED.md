# BrandGuard AI — targeted bug fixes

The existing application was patched in place. No rebuild, framework migration, dependency addition, or visual redesign was performed.

## Fixed issues

1. **Submission could fail after document creation.** The Creator flow now creates/updates the backend document, scans that persisted document, and submits only after the server has stored a scan for the exact saved content.
2. **Stale scan reuse.** Backend content changes invalidate scan results. Scanning checks the submitted text against the saved document, records a SHA-256 content hash, and submission rejects missing or stale hashes.
3. **Workspace approval bypass.** Workspace writes now enforce role-specific editable keys, creator ownership, reviewer/legal state transitions, protected submission fields, append-only decision/override/audit records, and server-attributed actors. Reviewer/Legal decisions are synchronized to the Mongo document/submission records.
4. **Critical override mismatch.** Critical findings can reach review. Reviewer/Legal overrides are validated and stored in the shared workspace; approval checks only previously committed, authorized overrides. The Mongo decision endpoint also checks workspace overrides using the linked client document ID.
5. **Decision reversal.** Workspace and Mongo decision routes enforce one-way transitions. Reviewer and Legal roles have separate permitted transitions; Admin cannot issue review/legal decisions.
6. **Scanner rule IDs.** Scanner rule mapping now supports both Mongo `_id` and workspace `id`.
7. **Lost updates from stale tabs.** Workspace snapshots use optimistic version checks. A stale write receives HTTP 409 rather than overwriting newer shared state.
8. **Open registration.** Self-registration no longer asks for or validates an invitation code. New accounts always receive the Creator role in the configured organization. Admin/Reviewer/Legal roles remain provisioned by an Admin or seed process.
9. **Organization casing.** Organization values are normalized to lowercase in schemas, registration, seed creation and route queries. Existing user organization values are normalized at API startup.

## Verification performed

- `npm run check`: all 4 existing test suites passed.
- `node --check`: all modified backend JavaScript files passed.
- TypeScript JSX parser check: all React `.jsx` files parsed successfully.

## Not verified

- Live MongoDB integration and multi-user concurrency were not run because no MongoDB connection was supplied.
- The Vite production build was not re-run in this environment; the available `vite` command failed with `Permission denied`.
- Existing user organization names are normalized at server startup. Existing workspace snapshots are version-initialized on first GET.
