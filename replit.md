# La Playita de Don Concho

Restaurant management system for La Playita de Don Concho — POS, table management, kitchen display, inventory with recipe-based deduction, expenses, analytics, and daily close, with role-based authentication.

## Run & Operate

- API runs automatically via the `artifacts/api-server: API Server` workflow
- `pnpm --filter @workspace/scripts run seed` — seed users, areas/tables, categories, products, inventory, recipes
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push schema changes (dev only)
- `pnpm run typecheck` — typecheck all packages
- Required env: `DATABASE_URL`, `JWT_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, JWT auth (bcryptjs + jsonwebtoken)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`)
- API codegen: Orval (OpenAPI → react-query hooks + Zod schemas)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/index.ts`
- API contract (source of truth): `lib/api-spec/openapi.yaml`
- API server routes: `artifacts/api-server/src/routes/*`
- Auth middleware: `artifacts/api-server/src/lib/auth.ts`
- Seed script: `scripts/src/seed.ts`

## Architecture decisions

- Recipe-based inventory: each `product` has `recipe_ingredients` linking to `inventory_items` with quantities; on sale we atomically deduct `quantity × sold` per ingredient and log `inventory_movements`.
- One open order per table at a time; `POST /api/orders` reuses any existing open/sent order for the table; payment closes order, marks kitchen ticket delivered, frees table, and writes inventory movements — all in one DB transaction.
- API uses `Bearer` JWT in `Authorization` header; `requireRole(...)` enforces ADMIN/WAITER/CASHIER.
- `lib/api-zod` re-exports Orval schemas (values) plus an explicit allow-list of types from `generated/types` to avoid duplicate identifier collisions.

## Product

Backend foundation complete: auth, users, tables (open/transfer/request payment), categories, products, recipes, inventory (CRUD + adjustments + low stock), orders + kitchen tickets, atomic sales (with inventory deduction), expenses, analytics dashboard (daily/weekly/monthly sales, expenses, top products, payment breakdown, sales trend, low stock, recent sales), product/waiter performance, inventory movements log, and daily close (preview/save/latest). Frontend (Task #2) is pending.

## Seeded credentials (dev)

- ADMIN: Sneider/101001, Ana/6041, Edwin/1985
- WAITER: Merari/9876, Nahomy/4565
- CASHIER: Donovan/0001
- 2 areas (El Jardín, Salón) × 30 tables each, 5 categories, 21 products with recipes, 29 inventory items.
- Seed runs automatically as part of `scripts/post-merge.sh` so a fresh environment is demo-ready after install + schema push.

## Gotchas

- Numeric columns are returned as strings by Drizzle; routes convert with `Number(...)` before responding.
- After editing `openapi.yaml` you must run `pnpm --filter @workspace/api-spec run codegen`.
- Daily close uses `onConflictDoUpdate` on `close_date` so calling it twice in one day updates the snapshot rather than failing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
