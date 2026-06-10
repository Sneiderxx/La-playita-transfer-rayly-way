import { Router, type IRouter } from "express";
import {
  db,
  sales,
  saleItems,
  payments,
  expenses,
  inventoryItems,
  inventoryMovements,
  users,
  restaurantTables,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function sumSales(from: Date) {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(${sales.total}),0)` })
    .from(sales)
    .where(gte(sales.createdAt, from));
  return Number(rows[0]?.total ?? 0);
}
async function countSales(from: Date) {
  const rows = await db
    .select({ c: sql<string>`COUNT(*)` })
    .from(sales)
    .where(gte(sales.createdAt, from));
  return Number(rows[0]?.c ?? 0);
}
async function sumExpenses(from: string) {
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}),0)` })
    .from(expenses)
    .where(gte(expenses.expenseDate, from));
  return Number(rows[0]?.total ?? 0);
}

router.get(
  "/dashboard",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const today = startOfDay();
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();
    const monthIso = isoDate(monthStart);
    const todayIso = isoDate(today);

    const [
      dailySales,
      weeklySales,
      monthlySales,
      dailyExpenses,
      monthlyExpenses,
      transactionsToday,
    ] = await Promise.all([
      sumSales(today),
      sumSales(weekStart),
      sumSales(monthStart),
      sumExpenses(todayIso),
      sumExpenses(monthIso),
      countSales(today),
    ]);

    const netProfit = monthlySales - monthlyExpenses;
    const averageTicket = transactionsToday > 0 ? dailySales / transactionsToday : 0;

    const topProductsRows = await db
      .select({
        productId: saleItems.productId,
        productName: saleItems.productName,
        quantity: sql<string>`SUM(${saleItems.quantity})`,
        revenue: sql<string>`SUM(${saleItems.lineTotal})`,
      })
      .from(saleItems)
      .leftJoin(sales, eq(sales.id, saleItems.saleId))
      .where(gte(sales.createdAt, monthStart))
      .groupBy(saleItems.productId, saleItems.productName)
      .orderBy(desc(sql`SUM(${saleItems.quantity})`))
      .limit(5);

    const paymentBreakdownRows = await db
      .select({
        method: payments.method,
        amount: sql<string>`COALESCE(SUM(${payments.amount}),0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(payments)
      .leftJoin(sales, eq(sales.id, payments.saleId))
      .where(gte(sales.createdAt, monthStart))
      .groupBy(payments.method);

    const trend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = startOfDay(d);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const dayIso = isoDate(day);
      const [salesRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${sales.total}),0)` })
        .from(sales)
        .where(and(gte(sales.createdAt, day), lte(sales.createdAt, next)));
      const [expRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}),0)` })
        .from(expenses)
        .where(eq(expenses.expenseDate, dayIso));
      trend.push({
        date: dayIso,
        sales: Number(salesRow?.total ?? 0),
        expenses: Number(expRow?.total ?? 0),
      });
    }

    const lowStock = await db
      .select()
      .from(inventoryItems)
      .where(lte(inventoryItems.currentQuantity, inventoryItems.minimumStock));

    const recentSalesRows = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.createdAt))
      .limit(8);
    const recentSales = [];
    for (const s of recentSalesRows) {
      const cashier = (
        await db.select().from(users).where(eq(users.id, s.cashierId))
      )[0];
      const pays = await db
        .select()
        .from(payments)
        .where(eq(payments.saleId, s.id));
      recentSales.push({
        id: s.id,
        orderId: s.orderId,
        tableId: s.tableId,
        tableNumber: 0,
        cashierName: cashier?.name ?? "",
        waiterName: null,
        subtotal: Number(s.subtotal),
        total: Number(s.total),
        createdAt: s.createdAt.toISOString(),
        paymentMethods: pays.map((p) => p.method),
      });
    }

    res.json({
      dailySales,
      weeklySales,
      monthlySales,
      dailyExpenses,
      monthlyExpenses,
      netProfit,
      averageTicket,
      transactionsToday,
      topProducts: topProductsRows.map((r) => ({
        productId: r.productId,
        productName: r.productName,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
      })),
      paymentBreakdown: paymentBreakdownRows.map((r) => ({
        method: r.method,
        amount: Number(r.amount),
        count: Number(r.count),
      })),
      salesTrend: trend,
      lowStock: lowStock.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        currentQuantity: Number(i.currentQuantity),
        minimumStock: Number(i.minimumStock),
        cost: Number(i.cost),
        supplier: i.supplier,
        updatedAt: i.updatedAt.toISOString(),
      })),
      recentSales,
    });
  }),
);

router.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const fromStr = req.query.from
      ? String(req.query.from)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return isoDate(d);
        })();
    const toStr = req.query.to ? String(req.query.to) : isoDate(new Date());
    const from = new Date(`${fromStr}T00:00:00`);
    const to = new Date(`${toStr}T23:59:59`);

    const rows = await db
      .select()
      .from(sales)
      .where(and(gte(sales.createdAt, from), lte(sales.createdAt, to)))
      .orderBy(desc(sales.createdAt));

    const totalSales = rows.reduce((s, r) => s + Number(r.total), 0);
    const transactionCount = rows.length;
    const averageTicket =
      transactionCount > 0 ? totalSales / transactionCount : 0;

    const userIds = Array.from(
      new Set(
        rows.flatMap((r) =>
          [r.cashierId, r.waiterId].filter((x): x is number => !!x),
        ),
      ),
    );
    const userRows =
      userIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, userIds))
        : [];
    const userMap = new Map(userRows.map((u) => [u.id, u.name]));
    const tableIds = Array.from(new Set(rows.map((r) => r.tableId)));
    const tableRows =
      tableIds.length > 0
        ? await db
            .select()
            .from(restaurantTables)
            .where(inArray(restaurantTables.id, tableIds))
        : [];
    const tableMap = new Map(tableRows.map((t) => [t.id, t.number]));
    const saleIds = rows.map((r) => r.id);
    const payRows =
      saleIds.length > 0
        ? await db
            .select()
            .from(payments)
            .where(inArray(payments.saleId, saleIds))
        : [];

    res.json({
      from: fromStr,
      to: toStr,
      totalSales,
      transactionCount,
      averageTicket,
      sales: rows.map((s) => ({
        id: s.id,
        orderId: s.orderId,
        tableId: s.tableId,
        tableNumber: tableMap.get(s.tableId) ?? 0,
        cashierName: userMap.get(s.cashierId) ?? "",
        waiterName: s.waiterId ? userMap.get(s.waiterId) ?? null : null,
        subtotal: Number(s.subtotal),
        total: Number(s.total),
        createdAt: s.createdAt.toISOString(),
        paymentMethods: payRows
          .filter((p) => p.saleId === s.id)
          .map((p) => p.method),
      })),
    });
  }),
);

router.get(
  "/sales-trend",
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Math.min(90, Number(req.query.days ?? 14)));
    const trend = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = startOfDay(d);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const dayIso = isoDate(day);
      const [salesRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${sales.total}),0)` })
        .from(sales)
        .where(and(gte(sales.createdAt, day), lte(sales.createdAt, next)));
      const [expRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}),0)` })
        .from(expenses)
        .where(eq(expenses.expenseDate, dayIso));
      trend.push({
        date: dayIso,
        sales: Number(salesRow?.total ?? 0),
        expenses: Number(expRow?.total ?? 0),
      });
    }
    res.json(trend);
  }),
);

router.get(
  "/products",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const where = [];
    if (req.query.from)
      where.push(gte(sales.createdAt, new Date(String(req.query.from))));
    if (req.query.to)
      where.push(
        lte(sales.createdAt, new Date(String(req.query.to) + "T23:59:59")),
      );
    const rows = await db
      .select({
        productId: saleItems.productId,
        productName: saleItems.productName,
        quantity: sql<string>`SUM(${saleItems.quantity})`,
        revenue: sql<string>`SUM(${saleItems.lineTotal})`,
      })
      .from(saleItems)
      .leftJoin(sales, eq(sales.id, saleItems.saleId))
      .where(where.length > 0 ? and(...where) : undefined)
      .groupBy(saleItems.productId, saleItems.productName)
      .orderBy(desc(sql`SUM(${saleItems.lineTotal})`));
    res.json(
      rows.map((r) => ({
        productId: r.productId,
        productName: r.productName,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
      })),
    );
  }),
);

router.get(
  "/waiters",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const where = [];
    if (req.query.from)
      where.push(gte(sales.createdAt, new Date(String(req.query.from))));
    if (req.query.to)
      where.push(
        lte(sales.createdAt, new Date(String(req.query.to) + "T23:59:59")),
      );
    const rows = await db
      .select({
        waiterId: sales.waiterId,
        waiterName: users.name,
        salesCount: sql<string>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(${sales.total}),0)`,
      })
      .from(sales)
      .leftJoin(users, eq(users.id, sales.waiterId))
      .where(where.length > 0 ? and(...where) : undefined)
      .groupBy(sales.waiterId, users.name)
      .orderBy(desc(sql`COALESCE(SUM(${sales.total}),0)`));
    res.json(
      rows
        .filter((r) => r.waiterId !== null)
        .map((r) => ({
          waiterId: r.waiterId!,
          waiterName: r.waiterName ?? "",
          salesCount: Number(r.salesCount),
          total: Number(r.total),
        })),
    );
  }),
);

router.get(
  "/inventory-movements",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: inventoryMovements.id,
        inventoryItemId: inventoryMovements.inventoryItemId,
        inventoryItemName: inventoryItems.name,
        change: inventoryMovements.change,
        reason: inventoryMovements.reason,
        userName: users.name,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.id, inventoryMovements.inventoryItemId),
      )
      .leftJoin(users, eq(users.id, inventoryMovements.userId))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(200);
    res.json(
      rows.map((r) => ({
        ...r,
        change: Number(r.change),
        inventoryItemName: r.inventoryItemName ?? "",
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }),
);

export default router;
