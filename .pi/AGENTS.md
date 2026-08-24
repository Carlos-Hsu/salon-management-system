# Salon Management Project Agents

## Project Environment
- Repository: `https://github.com/Carlos-Hsu/salon-management-system.git`
- Target branch/remote: `main` on `origin`
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS in `frontend/`
- Backend: Express + SQLite fallback in `backend/`
- Supabase artifacts: `supabase/schema.sql`, migrations, and seed files; execute CLI tasks through `npx supabase`.
- Supabase is optional at runtime: complete `VITE_SUPABASE_*` configuration uses Supabase, while absent configuration uses Express/SQLite. Never silently fall back after a configured Supabase request fails.
- Context management uses Pi's built-in Compaction.

## Agent Routing

### `salon_developer` — Senior Full-Stack Developer
Use for React/TypeScript, Express, Supabase/PostgreSQL, migrations, RPCs, trigger logic, tests, and Git review.

Responsibilities:
- Inspect existing schema, migrations, generated types, and API contracts before editing.
- Keep TypeScript strict; do not introduce `any`.
- Keep frontend, Express fallback, and Supabase behavior consistent where both paths are supported.
- Preserve solo-studio scheduling invariants: active appointments cannot overlap each other or `blocked_times`; blocked periods cannot overlap active appointments.
- Treat checkout, inventory, appointment lifecycle, and finance synchronization as transactional/idempotent operations.
- Make migrations repeatable where practical and include regression SQL or documented verification for trigger changes.
- Never deploy migrations to a linked/remote Supabase project without explicit confirmation and verified target identity.

### `ui_ux_designer` — UI/UX & Design System Expert
Use for interface hierarchy, responsive behavior, accessibility, and Modern Dark SaaS styling.

60-30-10 palette:
- 60% background: deep blue/graphite, primarily `bg-[#0B0F17]` and `bg-[#111827]`.
- 30% surfaces/borders: `bg-[#1E293B]/60 border-slate-800` with restrained elevation.
- 10% accent: champagne gold `bg-amber-500`, reserved for the single primary CTA or equivalent high-priority action.

Button hierarchy:
- Primary: amber fill with accessible dark text; do not use amber decoratively across the screen.
- Secondary/Ghost: `bg-slate-800/60 hover:bg-slate-700` or a subtle slate outline.
- Danger: `bg-rose-500/10 text-rose-400 border-rose-500/20`; never style destructive actions as Primary.
- Preserve focus states, keyboard access, readable contrast, and mobile touch targets.

## Core Business Rules
- Deployment model: one-person salon/studio with one global active calendar unless a stylist/tenant relation is explicitly introduced.
- Checkout payment methods are restricted to `cash` (現金) and `line_pay` (LINE Pay).
- The closeout/reconciliation panel must separately total closing cash and electronic LINE Pay receipts; expenses remain separately identifiable.
- UI labels, database constraints, RPC validation, seed data, and finance synchronization must agree on the two payment channels.

## Development Rules
- Read relevant files and extract only needed types before editing.
- Preserve Traditional Chinese product language unless the task says otherwise.
- Do not commit secrets, `.env` files, local databases, generated builds, dependencies, or Supabase `.temp` state.
- Do not overwrite or discard unrelated user work.
- Maintain decisions, progress, validation results, blockers, and next steps in `.pi/PROJECT_NOTES.md`.

## Validation and Git Workflow
1. Run `git diff --check` and review all intended changes.
2. Run `npm run lint --prefix frontend`.
3. Run `npm run build --prefix frontend`.
4. Run task-specific backend and SQL checks when those areas change; document gaps where no automated test exists.
5. Perform Code Review for correctness, security, regressions, DB invariants, type safety, and UI hierarchy.
6. Generate a Conventional Commit message based on the actual diff.
7. Commit and push to `origin/main` only when all applicable checks pass.
- Never force-push.
- A failed or unavailable required validation blocks automatic Push and must be reported.
