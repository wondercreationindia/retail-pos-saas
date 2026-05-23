# Retail POS SaaS

A multi-tenant Retail Point-of-Sale SaaS platform — lets store owners manage products, orders, teams, and analytics from a single dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/retail-pos-saas run dev` — run the frontend (port 25571)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Demo credentials

- **Admin:** `admin@demo.com` / `demo1234`
- **Cashier:** `cashier@demo.com` / `demo1234`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter (routing), Zustand (auth state), TanStack Query
- API: Express 5, JWT authentication (jsonwebtoken + bcryptjs)
- DB: PostgreSQL (Replit-managed) + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Supabase: configured for future use (env vars set)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (tenants, users, categories, products, orders)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, tenants, users, categories, products, orders, dashboard)
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify + bcrypt helpers + requireAuth middleware
- `artifacts/retail-pos-saas/src/` — React frontend (pages, hooks, components)
- `artifacts/retail-pos-saas/src/hooks/use-auth.ts` — Zustand auth store (token + user in localStorage)
- `lib/api-client-react/src/custom-fetch.ts` — injects `Authorization: Bearer <token>` from localStorage

## Architecture decisions

- **Multi-tenant by design:** Every DB table includes `tenant_id` — all queries are scoped to the authenticated tenant.
- **JWT-first auth:** Stateless JWTs stored in `localStorage` as `pos_token`. No session table needed.
- **OpenAPI-first:** All routes are defined in `openapi.yaml` first; Orval generates typed React Query hooks and Zod schemas. Never hand-write what codegen produces.
- **JSONB for order items:** Order line items are stored as JSONB in the orders table — avoids a separate join table for the initial build while keeping the data queryable.
- **Replit DB is primary:** Supabase credentials are configured for potential future use (e.g. auth, storage, realtime), but Replit's built-in PostgreSQL is the active database.

## Product

- **Login / Register** — JWT auth with tenant creation on register
- **Dashboard** — Today's revenue, order count, 7-day sales chart, recent orders, top products
- **Products** — Full CRUD with category filtering, search, low-stock warnings (< 10 units)
- **Orders** — Full order history with status filtering, line-item detail view
- **Categories** — Product category management with color coding
- **Users / Team** — Multi-role user management (admin, manager, cashier)
- **Settings** — Tenant profile (name, currency, timezone)

## User preferences

- Wants React + Vite (not Next.js) — this is a Replit pnpm monorepo
- Multi-tenant Retail POS SaaS using Supabase PostgreSQL (Supabase env vars configured)
- Production-ready, beginner-friendly code
- Modular folder structure

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` before touching route handlers or frontend hooks.
- `pnpm run typecheck` must pass before deploying — it typechecks both libs and leaf packages.
- The frontend reads `pos_token` from localStorage for auth — clear it to log out manually during testing.
- Numeric columns (`price`, `subtotal`, `tax`, `total`) come back as strings from Drizzle/pg — always `parseFloat()` before returning from routes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
