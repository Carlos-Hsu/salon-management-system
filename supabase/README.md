# Supabase integration

## Deployment status

`schema.sql` is a migration artifact only. It has **not been deployed**: this repository has no database password, service-role key, or Supabase access token. Apply it manually in the project SQL editor, then regenerate the TypeScript database types.

## Runtime mode

This is Vite + React with an Express/SQLite backend, not Next.js. Root `NEXT_PUBLIC_*` values are retained only as requested configuration documentation; Vite reads the equivalent `frontend/.env.local` `VITE_SUPABASE_*` values. Never place a service-role key or other server secret in a `VITE_*` variable.

When both Vite variables are present, customer, service, product, appointment, blocked-time, and checkout operations use Supabase. When both are absent, those operations use Express/SQLite. Partial configuration fails at startup, and a failed configured Supabase request never falls back to SQLite. Finance transactions and holiday surcharge settings remain explicitly Express-backed because the current Supabase order ledger has no matching finance UI yet.

The checkout RPC is atomic and idempotent, locks inventory, writes order/line/stock audit records, and only then completes an in-service appointment. Appointment create/reschedule RPCs plus constraints/triggers enforce the solo-studio calendar and lifecycle. Custom items are JSON/order lines and are never inserted into `services`.

## Security warning

The `dev_anon_all` RLS policies deliberately allow unauthenticated publishable-key CRUD for a local/development solo studio. **Do not use these policies in production.** Anyone with the public key can read or mutate salon data. Before production, require Supabase Auth, replace these policies with owner/tenant-scoped policies, restrict RPC execution, and add tenant/stylist ownership to every relevant row and overlap rule.

The current requested model has no stylist field/table, so overlap is enforced against one global solo-studio calendar. It must not be described as per-stylist scheduling until a stylist relation is added.
