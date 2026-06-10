import { expect, Page, request, APIRequestContext } from "@playwright/test";

export function apiBase(): string {
  const explicit = process.env.E2E_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0]!.trim();
    if (first) return `https://${first}/api`;
  }
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}/api`;
  return "http://localhost:5000/api";
}

export async function apiLogin(
  ctx: APIRequestContext,
  name: string,
  password: string,
): Promise<{ token: string; user: { id: number; role: string; name: string } }> {
  const res = await ctx.post(`${apiBase()}/auth/login`, {
    data: { name, password },
  });
  expect(res.ok(), `login(${name}) failed: ${res.status()}`).toBeTruthy();
  return res.json();
}

export async function uiLogin(
  page: Page,
  name: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.locator("#name").fill(name);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Enter System" }).click();
}

/**
 * Skip the login UI by injecting a token + user into localStorage. The
 * AuthProvider in src/lib/auth.tsx hydrates from these keys on page load.
 */
export async function seedAuth(
  page: Page,
  name: string,
  password: string,
): Promise<{ id: number; role: string; name: string }> {
  const ctx = await request.newContext();
  try {
    const { token, user } = await apiLogin(ctx, name, password);
    // Visit a no-op route once so we have a same-origin context to write to.
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([t, u]) => {
        localStorage.setItem("laplayita.token", t as string);
        localStorage.setItem("laplayita.user", JSON.stringify(u));
      },
      [token, user],
    );
    return user;
  } finally {
    await ctx.dispose();
  }
}

export interface TableSummary {
  id: number;
  number: number;
  status: string;
  currentOrderId: number | null;
  currentTotal: number;
  areaName: string;
}

export interface ProductSummary {
  id: number;
  name: string;
  price: string | number;
}

export async function pickFreeTable(
  ctx: APIRequestContext,
  token: string,
): Promise<TableSummary> {
  const res = await ctx.get(`${apiBase()}/tables`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const tables = (await res.json()) as TableSummary[];
  const free = tables.find((t) => t.status === "free");
  if (!free) {
    throw new Error("No free table available; reseed the dev DB and retry.");
  }
  return free;
}

export async function findProduct(
  ctx: APIRequestContext,
  token: string,
  name: string,
): Promise<ProductSummary> {
  const res = await ctx.get(`${apiBase()}/products`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const products = (await res.json()) as ProductSummary[];
  const p = products.find((x) => x.name === name);
  if (!p) throw new Error(`Product '${name}' not found in catalog`);
  return p;
}

export async function createOrder(
  ctx: APIRequestContext,
  token: string,
  body: { tableId: number; items: Array<{ productId: number; quantity: number }> },
): Promise<{ id: number; total: number }> {
  const res = await ctx.post(`${apiBase()}/orders`, {
    headers: { authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok(), `createOrder failed: ${res.status()}`).toBeTruthy();
  return res.json();
}

export async function setTableStatus(
  ctx: APIRequestContext,
  token: string,
  tableId: number,
  status: "free" | "occupied" | "waiting_payment" | "closed",
): Promise<void> {
  const res = await ctx.patch(`${apiBase()}/tables/${tableId}/status`, {
    headers: { authorization: `Bearer ${token}` },
    data: { status },
  });
  expect(res.ok(), `setTableStatus(${status}) failed: ${res.status()}`).toBeTruthy();
}

export async function recordSale(
  ctx: APIRequestContext,
  token: string,
  orderId: number,
  amount: number,
  method: "cash" | "card" | "transfer" = "cash",
): Promise<void> {
  const res = await ctx.post(`${apiBase()}/sales`, {
    headers: { authorization: `Bearer ${token}` },
    data: { orderId, payments: [{ method, amount }] },
  });
  expect(res.ok(), `recordSale failed: ${res.status()}`).toBeTruthy();
}
