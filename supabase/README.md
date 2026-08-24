# Supabase integration

## Runtime mode

This project is Vite + React with an Express/SQLite compatibility backend, not Next.js. Vite reads `frontend/.env.local` `VITE_SUPABASE_*` values. Never expose a service-role key, database password, or other server secret through a `VITE_*` variable.

When both Supabase variables are present, customers, services, products, appointments, blocked times, checkout, finance, and system settings use Supabase. Partial configuration fails at startup, and a configured Supabase request never silently falls back to SQLite.

The checkout RPC is atomic and idempotent, locks inventory, writes order, line-item, stock-audit, and finance records, and only then completes an in-service appointment. Appointment RPCs plus constraints and triggers enforce the solo-studio global calendar and lifecycle.

## Authentication and authorization

The current schema requires Supabase Auth for salon data:

- Anonymous table privileges and `dev_anon_all` policies are removed.
- Authenticated users can manage daily operational records.
- `super_admin` exclusively manages services, system settings, and profile roles.
- The oldest existing Auth user is promoted only when no super admin exists; on a fresh project, the first user becomes super admin.
- Subsequent users default to `staff`.

The frontend emergency PIN is development-only and read-only. It is not a database authorization mechanism.

Before production deployment, configure `VITE_TURNSTILE_SITE_KEY` in Vercel and the matching Cloudflare Turnstile secret in Supabase Auth CAPTCHA settings.

## Deployment

For a new project, execute [`schema.sql`](schema.sql) in the Supabase SQL Editor. It is the canonical schema and includes profiles, settings, RLS, triggers, RPCs, and grants.

For an existing project, apply migrations in filename order. The authorization hardening migrations are:

```text
migrations/20260827_authenticated_core_rls.sql
migrations/20260828_revoke_public_rpc_execute.sql
```

The follow-up migration removes PostgreSQL's default `PUBLIC` function execution grant, which is inherited by `anon`. After applying both, execute the read-only verification script:

```text
tests/authenticated_rls_checks.sql
```

Do not apply migrations until the target Supabase project identity is confirmed. Back up the database before schema changes.

## Calendar model

The schema has one global solo-studio calendar and no stylist relation. Active appointments cannot overlap each other or blocked periods; adjacent half-open time ranges are allowed. Do not describe scheduling as per-stylist until a stylist or tenant relation is introduced.
