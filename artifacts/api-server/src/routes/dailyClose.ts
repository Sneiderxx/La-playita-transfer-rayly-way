import { Router, type IRouter } from "express";
import {
  db,
  sales,
  saleItems,
  payments,
  expenses,
  inventoryItems,
  dailyCloses,
} from "@workspace/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

function localNow() {
  const tz = process.env.TZ || "America/Guatemala";
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}
function startOfDay(d = localNow()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = localNow()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function buildSnapshot(date: Date) {
  const start = startOfDay(date);
  const end = endOfDay(date);
  const dayIso = isoDate(date);

  const [salesRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${sales.total}),0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(sales)
    .where(and(gte(sales.createdAt, start), lte(sales.createdAt, end)));
  const totalSales = Number(salesRow?.total ?? 0);
  const transactionCount = Number(salesRow?.count ?? 0);

  const [expRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}),0)` })
    .from(expenses)
    .where(eq(expenses.expenseDate, dayIso));
  const totalExpenses = Number(expRow?.total ?? 0);

  const paymentRows = await db
    .select({
      method: payments.method,
      amount: sql<string>`COALESCE(SUM(${payments.amount}),0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(payments)
    .leftJoin(sales, eq(sales.id, payments.saleId))
    .where(and(gte(sales.createdAt, start), lte(sales.createdAt, end)))
    .groupBy(payments.method);

  const productRows = await db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      quantity: sql<string>`SUM(${saleItems.quantity})`,
      revenue: sql<string>`SUM(${saleItems.lineTotal})`,
    })
    .from(saleItems)
    .leftJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(gte(sales.createdAt, start), lte(sales.createdAt, end)))
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(sql`SUM(${saleItems.quantity})`))
    .limit(10);

  const lowStock = await db
    .select()
    .from(inventoryItems)
    .where(lte(inventoryItems.currentQuantity, inventoryItems.minimumStock));

  return {
    closeDate: dayIso,
    totalSales,
    totalExpenses,
    netProfit: totalSales - totalExpenses,
    transactionCount,
    paymentBreakdown: paymentRows.map((r) => ({
      method: r.method,
      amount: Number(r.amount),
      count: Number(r.count),
    })),
    topProducts: productRows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
    })),
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
  };
}

router.get(
  "/preview",
  asyncHandler(async (_req, res) => {
    res.json(await buildSnapshot(new Date()));
  }),
);

router.get(
  "/latest",
  asyncHandler(async (_req, res) => {
    const [latest] = await db
      .select()
      .from(dailyCloses)
      .orderBy(desc(dailyCloses.closeDate))
      .limit(1);
    if (!latest) return res.json(await buildSnapshot(new Date()));
    res.json({
      id: latest.id,
      closeDate: latest.closeDate,
      totalSales: Number(latest.totalSales),
      totalExpenses: Number(latest.totalExpenses),
      netProfit: Number(latest.netProfit),
      transactionCount: latest.transactionCount,
      createdAt: latest.createdAt.toISOString(),
      ...(latest.payload as object),
    });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const snap = await buildSnapshot(new Date());
    const [created] = await db
      .insert(dailyCloses)
      .values({
        closeDate: snap.closeDate,
        totalSales: snap.totalSales.toFixed(2),
        totalExpenses: snap.totalExpenses.toFixed(2),
        netProfit: snap.netProfit.toFixed(2),
        transactionCount: snap.transactionCount,
        payload: {
          paymentBreakdown: snap.paymentBreakdown,
          topProducts: snap.topProducts,
          lowStock: snap.lowStock,
        },
        createdById: req.auth!.userId,
      })
      .onConflictDoUpdate({
        target: dailyCloses.closeDate,
        set: {
          totalSales: snap.totalSales.toFixed(2),
          totalExpenses: snap.totalExpenses.toFixed(2),
          netProfit: snap.netProfit.toFixed(2),
          transactionCount: snap.transactionCount,
          payload: {
            paymentBreakdown: snap.paymentBreakdown,
            topProducts: snap.topProducts,
            lowStock: snap.lowStock,
          },
          createdById: req.auth!.userId,
        },
      })
      .returning();
    res.json({
      ...snap,
      id: created.id,
      createdAt: created.createdAt.toISOString(),
    });
  }),
);

export default router;
