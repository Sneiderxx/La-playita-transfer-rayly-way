# La Playita POS — End-to-End Test Suite

These tests exercise the full POS flow (login → order → kitchen → POS →
daily-close) against a running instance of the restaurant web app, backed by
the live API server and the seeded demo database.

The suite runs as **real browser tests** (Playwright + Chromium headless).
Each scenario in `test-plans.ts` has a one-to-one Playwright spec under
`specs/` that drives the actual UI — clicking buttons, filling inputs,
asserting on rendered text and toasts.

## How to run

### Single command (shell, used by validation / pre-merge)

```bash
pnpm test:e2e
# or, equivalently:
pnpm --filter @workspace/restaurant run test:e2e
```

The runner (`tests/run-all.ts`):

1. Cross-checks every entry in `ALL_TESTS` (from `test-plans.ts`) against the
   Playwright report so a plan can't silently lose its spec.
2. Resets the demo database to a clean seeded state (see "Demo data reset"
   below). Set `E2E_SKIP_RESET=1` to skip — useful when iterating on a
   single spec and you don't want to wait on a reset.
3. Invokes `playwright test` with the `chromium` project.
4. Prints `PASS` / `FAIL` per scenario by name. On failure it surfaces the
   first error line plus the absolute path to the screenshot Playwright
   captured (configured as `screenshot: "only-on-failure"`) and the trace
   archive.

The JSON report is written to `.local/state/restaurant-e2e-report.json` and
all screenshots/traces are written under `/tmp/restaurant-e2e-artifacts/`.

The runner targets `https://$REPLIT_DOMAINS/` by default. Override with
`E2E_BASE_URL=...` (and/or `E2E_API_BASE_URL=...` for backend setup) if you
need to point at a different deployment.

This command is also registered as a [validation](../../../.local/skills/validation/SKILL.md)
step under the name `e2e` so it runs automatically before merging.

### Running a single scenario

```bash
pnpm --filter @workspace/restaurant exec playwright test \
  --config tests/playwright.config.ts \
  tests/specs/cashier-payment.spec.ts
```

Each spec's `test(...)` title matches the `name` in `ALL_TESTS` exactly, so
results from `playwright test --grep <name>` line up with the plan list.

## Prerequisites

1. The `artifacts/api-server` workflow must be running.
2. The `artifacts/restaurant` workflow must be running.
3. The development database must be seeded (`pnpm --filter @workspace/scripts run seed`).
   The seed creates the demo users, tables, products, and recipes used by the
   tests.
4. Chromium and its system libraries must be available. On a fresh Replit:

   ```bash
   pnpm --filter @workspace/restaurant exec playwright install chromium
   ```

   The required Nix system libraries (`glib`, `nss`, `libgbm`, etc.) are
   already declared in the project; `pnpm install` will pick them up.

## Demo data reset

The e2e suite shares the development database with the user, so each run
would otherwise leave behind occupied tables, sales, and kitchen tickets.
To keep results predictable, the runner calls a reset script before
launching Playwright:

```bash
pnpm --filter @workspace/scripts run reset:demo
```

`scripts/src/reset-demo.ts`:

1. `TRUNCATE ... RESTART IDENTITY CASCADE` on the transactional tables
   (`payments`, `sale_items`, `sales`, `kitchen_tickets`, `order_items`,
   `orders`, `expenses`, `daily_closes`, `inventory_movements`).
2. Marks every row in `restaurant_tables` as `free` and clears
   `opened_at` / `opened_by_user_id`.
3. Re-runs the seed (`runSeed({ resetQuantity: true })`) to make sure the
   baseline rows (roles, users, areas, tables, categories, products,
   recipes, inventory) exist and inventory `current_quantity` /
   `minimum_stock` / `cost` / `supplier` / `unit` are reset to their
   seed values. Schema is left untouched.

Skip the reset for a single iteration with `E2E_SKIP_RESET=1`. Run the
reset standalone any time the demo data has drifted:

```bash
pnpm --filter @workspace/scripts run reset:demo
```

## Seeded users used by the tests

| Username | Password | Role    |
| -------- | -------- | ------- |
| Sneider  | 101001   | ADMIN   |
| Merari   | 9876     | WAITER  |
| Donovan  | 0001     | CASHIER |

## What is covered

- `loginPerRole`     — login redirect for ADMIN / WAITER / CASHIER + bad
  credentials toast.
- `waiterOpenTable`  — waiter opens a free table and adds items, creating an
  active order and a kitchen ticket; total reflects Q90.00 and the cart
  empties after sending.
- `kitchenLifecycle` — kitchen ticket advances pending → preparing → ready →
  delivered and disappears from the active board.
- `cashierPayment`   — waiter requests payment, table appears on POS, cashier
  closes it with a cash payment and the card disappears.
- `dailyClosePreview` — admin sees the daily close preview reflecting today's
  sales, payment breakdown, and top products. (Finalization is intentionally
  NOT triggered because closing the day is a once-per-day, irreversible
  action.)
