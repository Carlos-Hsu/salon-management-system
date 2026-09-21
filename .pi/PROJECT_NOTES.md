# Project Notes

## Current Architecture
- React 18 + TypeScript + Vite + Tailwind frontend in `frontend/`.
- Express + SQLite fallback backend in `backend/`.
- Supabase schema, migrations, seeds, RPCs, constraints, and triggers are present in `supabase/`.
- Runtime uses Supabase when both required Vite variables are configured; otherwise supported operations use Express/SQLite.

## Business Invariants
- Solo-studio mode uses one global active appointment calendar.
- Payment methods are restricted to `cash` and `line_pay`.
- Closeout reconciliation reports cash and LINE Pay separately.
- Appointment/blocked-time overlap protection and appointment lifecycle checks are DB-enforced in the Supabase schema.

## Git Policy
- Repository: `https://github.com/Carlos-Hsu/salon-management-system.git`
- Remote/branch: `origin/main`
- Push only after applicable validation and Code Review pass; never force-push.

## Pi Environment
- Local extensions live in `.pi/extensions/`.
- `project-notes.ts` injects `.pi/AGENTS.md` and this file into trusted project turns.
- `context-trimmer.ts` delegates context reduction to Pi's built-in Compaction near 80% usage.
- `git-review.ts` runs diff, lint, and build gates before allowing a push of already committed changes.
- Supabase CLI is available through `npx supabase` (verified version 2.115.0).

## Progress
- [x] Verified `origin` URL and `main` tracking branch.
- [x] Defined `salon_developer` and `ui_ux_designer` responsibilities.
- [x] Recorded business payment and closeout rules.
- [x] Added project-local git review, project notes, and context compaction drafts.
- [x] Fast-forwarded local `main` to remote v1.1.0 follow-up commit `4cdd607`.
- [x] Added authenticated core RLS migration and removed canonical anonymous salon-data access.
- [x] Integrated `profiles` and `system_settings` into the canonical schema.
- [x] Replaced hard-coded admin email with first-user super-admin bootstrap.
- [x] Added lazy-loaded feature views to reduce the main JavaScript chunk.
- [x] Added a repeatable product-mutation migration: restores the missing `update_product` RPC and permits deletion of unsold products together with their inventory audit rows, while preserving products referenced by historical orders.
- [x] Fixed both new-appointment forms so their displayed default and submitted service ID always come from the currently active service list; inactive historical services remain available only when editing an existing appointment.
- [x] Added visible, localized conflict feedback and saving states to both appointment forms so overlapping appointments no longer fail silently.
- [x] Released calendar capacity immediately after checkout: completed appointments remain auditable but no longer block the next booking; pending, confirmed, and in-service appointments still enforce overlap protection.
- [x] Changed the new-service duration field to start at 0 minutes and reset to 0 after creation, while retaining the 15-minute minimum for saved services and valid appointment intervals.

## Validation Status
- `npm run lint --prefix frontend`: passed.
- `npm run build --prefix frontend`: passed; main chunk reduced from about 528 kB to 424 kB and the previous chunk-size warning is resolved.
- `npm test --prefix backend`: 11/11 passed.
- `git diff --check`: passed.
- `npm audit --prefix frontend --omit=dev`: previously reported 0 production vulnerabilities.
- Pi project-extension discovery completed without loader errors.
- Remote Supabase deployment status is not verified; `20260827_authenticated_core_rls.sql` has not been applied remotely.
- Product mutation fix in `20260921_fix_product_update_delete.sql` was applied successfully to Supabase project `tgnusjcsqwuvojykgrgj` (`salon-system`) on 2026-09-21.

## Follow-up
- Verify the target Supabase project identity, then apply migrations in order and run `supabase/tests/authenticated_rls_checks.sql`.
- Configure a production `VITE_TURNSTILE_SITE_KEY` and matching Supabase Auth CAPTCHA secret before deployment.
- Review the two development-dependency audit findings separately; do not use `npm audit fix --force` without compatibility review.
- Add automated PostgreSQL integration tests for overlap, lifecycle, checkout, inventory, and finance triggers.
