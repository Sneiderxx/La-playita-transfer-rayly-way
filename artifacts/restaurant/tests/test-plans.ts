/**
 * End-to-end test plans for the La Playita POS web app.
 *
 * Each plan is a free-form description consumed by Replit's `runTest()`
 * Playwright-based testing subagent. See ./README.md for how to run them.
 */

export interface E2ETestPlan {
  name: string;
  plan: string;
  docs: string;
}

const SHARED_DOCS = `
App location: served by the "web" workflow in artifacts/restaurant. Use the
restaurant preview path (base path "/"). Routes are wouter-based: /login,
/dashboard, /tables, /tables/:id/order, /pos, /kitchen, /daily-close.

API: served by the "api-server" workflow under base path "/api" (e.g.
/api/auth/login). All authenticated endpoints require a Bearer JWT issued by
POST /api/auth/login.

Seeded demo users (see scripts/src/seed.ts):
  - ADMIN:   { name: "Sneider", password: "101001" }
  - WAITER:  { name: "Merari",  password: "9876" }
  - CASHIER: { name: "Donovan", password: "0001" }

Seeded categories include "Ceviches", "Hamburguesas", "Mariscos", "Bebidas",
"Entradas". Seeded products include "Cheeseburger Don Concho" (Q75),
"Coca-Cola" (Q15), "Papas Fritas" (Q30).

Login form selectors: input #name (Username), input #password (Password),
submit button labeled "Enter System". On success the app redirects:
  ADMIN -> /dashboard, WAITER -> /tables, CASHIER -> /pos.

Tables page: cards in a grid, free table cards show "Available" and a "#<n>"
header. Clicking a free table opens it (POST /api/tables/:id/open) and
navigates to /tables/:id/order.

Table-order page: left pane has product cards (click to add to cart) and a
search input ("Search products..."). Right pane shows the cart with quantity
+/- buttons, a Send button (sends/creates the order; calls POST /api/orders or
PATCH /api/orders/:id/items), and a Pay button (sets the table to
"waiting_payment" via PATCH /api/tables/:id/status).

Kitchen page (/kitchen): cards per active ticket. The action button advances
status: "Start Preparing" -> "Mark Ready" -> "Deliver". Once "Deliver" is
clicked the ticket leaves the active board.

POS page (/pos): lists tables in waiting_payment. Clicking a card opens a
dialog with a payment method select (cash/card/transfer) and a "Confirm
Payment" button that calls POST /api/sales.

Daily Close page (/daily-close, ADMIN only): renders a Z-Report with
Financial Summary (Gross Sales, Total Expenses, Net Profit), Payment
Breakdown, Operations (Total Transactions), Top Selling Products, and Low
Stock items. The "FINALIZE DAY AND CLOSE" button is destructive (once per
day) and MUST NOT be clicked by tests.

Sidebar navigation uses data-testid="nav-<route>" (e.g. nav-tables,
nav-kitchen, nav-pos, nav-daily-close). The signed-in username is rendered
with data-testid="text-username".
`;

export const loginPerRole: E2ETestPlan = {
  name: "loginPerRole",
  docs: SHARED_DOCS,
  plan: `
1. [New Context] Create a new browser context.
2. [Browser] Navigate to /login.
3. [Browser] Fill #name with "Sneider", fill #password with "101001", click "Enter System".
4. [Verify] Assert URL ends with /dashboard and the sidebar shows username "Sneider".
5. [Browser] Click the user logout button (LogOut icon button at the bottom of the sidebar) to return to /login.
6. [Browser] Fill #name with "Merari", fill #password with "9876", click "Enter System".
7. [Verify] Assert URL ends with /tables and the sidebar shows username "Merari".
8. [Browser] Logout again to return to /login.
9. [Browser] Fill #name with "Donovan", fill #password with "0001", click "Enter System".
10. [Verify] Assert URL ends with /pos and the sidebar shows username "Donovan".
11. [Browser] Logout. Then attempt to login with name "Merari" and a wrong password "wrong".
12. [Verify] Assert a "Login failed" toast appears and URL is still /login.
`,
};

export const waiterOpenTable: E2ETestPlan = {
  name: "waiterOpenTable",
  docs: SHARED_DOCS,
  plan: `
1. [New Context] Create a new browser context.
2. [Browser] Navigate to /login. Login as waiter Merari / 9876. Wait for redirect to /tables.
3. [Browser] On the Tables page, in the "El Jardín" tab, click the first card showing "Available" (a free table). Note the table number shown as "#<n>" (call it tableNumber).
4. [Verify] Assert URL matches /tables/<id>/order and the right pane heading reads "Table #<tableNumber>".
5. [Browser] In the search input ("Search products..."), type "Cheeseburger". Click the "Cheeseburger Don Concho" product card. Clear the search, type "Coca", and click the "Coca-Cola" product card.
6. [Verify] Assert two new items appear under the "New Items" section in the right pane and the Total updates to Q90 (75 + 15).
7. [Browser] Click the "Send" button.
8. [Verify]
   - Assert a success toast appears ("Order created and sent to kitchen" or "Added to existing order").
   - Assert the items move to the "Sent to Kitchen" section.
   - Assert the cart "New Items" section is no longer shown.
9. [Browser] Navigate back to /tables.
10. [Verify] Assert the previously opened table card now shows it is occupied (has a waiter name and a money total of Q90, no longer says "Available").
`,
};

export const kitchenLifecycle: E2ETestPlan = {
  name: "kitchenLifecycle",
  docs: SHARED_DOCS,
  plan: `
1. [New Context] Create a new browser context.
2. [API] POST /api/auth/login with { name: "Merari", password: "9876" }. Save the returned token as $WAITER_TOKEN.
3. [API] GET /api/tables with Authorization: Bearer $WAITER_TOKEN. Pick the first table where status === "free"; call its id $TABLE_ID and number $TABLE_NUM.
4. [API] GET /api/products. Pick the product where name === "Papas Fritas"; call its id $PRODUCT_ID.
5. [API] POST /api/orders with body { tableId: $TABLE_ID, items: [{ productId: $PRODUCT_ID, quantity: 1 }] } and the bearer token. This creates an order AND a kitchen ticket in status "pending".
6. [Browser] Navigate to /login. Login as Merari / 9876. Click sidebar item nav-kitchen to go to /kitchen.
7. [Verify] Assert a kitchen ticket card exists with header "Table #$TABLE_NUM" and status badge "pending", containing the item "Papas Fritas".
8. [Browser] On that card, click the "Start Preparing" button.
9. [Verify] Assert the same card's status badge changes to "preparing" and the button label becomes "Mark Ready".
10. [Browser] Click "Mark Ready".
11. [Verify] Assert the card's status badge becomes "ready" and the button label becomes "Deliver".
12. [Browser] Click "Deliver".
13. [Verify] Assert the card for Table #$TABLE_NUM is no longer shown on the active kitchen board (it moved to "delivered" and is filtered out).
`,
};

export const cashierPayment: E2ETestPlan = {
  name: "cashierPayment",
  docs: SHARED_DOCS,
  plan: `
1. [New Context] Create a new browser context.
2. [API] POST /api/auth/login with { name: "Merari", password: "9876" }; save token $WAITER_TOKEN.
3. [API] GET /api/tables (bearer $WAITER_TOKEN). Pick a table where status === "free"; call its id $TABLE_ID and number $TABLE_NUM.
4. [API] GET /api/products. Find the product named "Coca-Cola"; call its id $PRODUCT_ID and note its price (15).
5. [API] POST /api/orders with bearer $WAITER_TOKEN and body { tableId: $TABLE_ID, items: [{ productId: $PRODUCT_ID, quantity: 2 }] }. Note the returned order id as $ORDER_ID and total 30.
6. [API] PATCH /api/tables/$TABLE_ID/status with bearer $WAITER_TOKEN and body { status: "waiting_payment" } to mark the table ready to pay.
7. [Browser] Navigate to /login. Login as cashier Donovan / 0001. Wait for redirect to /pos.
8. [Verify] Assert at least one card appears with title "Table #$TABLE_NUM" and an amount of Q30.00.
9. [Browser] Click that card. A dialog "Process Payment - Table #$TABLE_NUM" should open.
10. [Verify]
    - Assert the dialog shows "Total Due:" of Q30.00.
    - Assert the payment method select defaults to "Cash".
11. [Browser] Click "Confirm Payment".
12. [Verify]
    - Assert a "Payment processed successfully" toast appears.
    - Assert the dialog closes and the Table #$TABLE_NUM card no longer appears on the POS list.
13. [Browser] Click sidebar item nav-tables.
14. [Verify] Assert the table for #$TABLE_NUM is back to the "Available" state (free, no waiter, no total).
`,
};

export const dailyClosePreview: E2ETestPlan = {
  name: "dailyClosePreview",
  docs: SHARED_DOCS,
  plan: `
1. [New Context] Create a new browser context.
2. [API] POST /api/auth/login with { name: "Merari", password: "9876" }; save token $WAITER_TOKEN.
3. [API] GET /api/tables (bearer $WAITER_TOKEN). Pick a free table; note id $TABLE_ID.
4. [API] GET /api/products. Find product "Cheeseburger Don Concho"; note id $PRODUCT_ID and price 75.
5. [API] POST /api/orders bearer $WAITER_TOKEN body { tableId: $TABLE_ID, items: [{ productId: $PRODUCT_ID, quantity: 1 }] }; note order id $ORDER_ID.
6. [API] PATCH /api/tables/$TABLE_ID/status bearer $WAITER_TOKEN body { status: "waiting_payment" }.
7. [API] POST /api/auth/login with { name: "Donovan", password: "0001" }; save token $CASHIER_TOKEN.
8. [API] POST /api/sales bearer $CASHIER_TOKEN body { orderId: $ORDER_ID, payments: [{ method: "cash", amount: 75 }] } to record a sale.
9. [Browser] Navigate to /login. Login as admin Sneider / 101001. Wait for redirect to /dashboard.
10. [Browser] Click sidebar item nav-daily-close to go to /daily-close.
11. [Verify]
    - Assert the page shows "Z-REPORT - END OF DAY".
    - Assert the FINANCIAL SUMMARY section shows a Gross Sales value greater than or equal to Q75.00.
    - Assert the Total Transactions value is at least 1.
    - Assert the PAYMENT BREAKDOWN section includes a "cash" line.
    - Assert the TOP SELLING PRODUCTS section is present and includes at least one product (e.g. "Cheeseburger Don Concho").
    - Assert a "FINALIZE DAY AND CLOSE" button is visible (do NOT click it).
12. [Browser] Do NOT click the finalize button. End the test.
`,
};

export const ALL_TESTS: E2ETestPlan[] = [
  loginPerRole,
  waiterOpenTable,
  kitchenLifecycle,
  cashierPayment,
  dailyClosePreview,
];
