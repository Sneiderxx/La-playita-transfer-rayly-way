import { Router, type IRouter } from "express";
import {
  db,
  sales,
  saleItems,
  payments,
  orders,
  orderItems,
  products,
  recipes,
  recipeIngredients,
  inventoryItems,
  inventoryMovements,
  restaurantTables,
  kitchenTickets,
  users,
  expenses,
  dailyCloses,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

function localDateIso(d = new Date()) {
  const tz = process.env.TZ || "America/Guatemala";
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function mapSales(rows: Array<typeof sales.$inferSelect>) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const allPayments = await db
    .select()
    .from(payments)
    .where(inArray(payments.saleId, ids));
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
  const tableRows = await db
    .select()
    .from(restaurantTables)
    .where(inArray(restaurantTables.id, rows.map((r) => r.tableId)));
  const tableMap = new Map(tableRows.map((t) => [t.id, t.number]));

  return rows.map((s) => ({
    id: s.id,
    orderId: s.orderId,
    tableId: s.tableId,
    tableNumber: tableMap.get(s.tableId) ?? 0,
    cashierName: userMap.get(s.cashierId) ?? "",
    waiterName: s.waiterId ? userMap.get(s.waiterId) ?? null : null,
    subtotal: Number(s.subtotal),
    total: Number(s.total),
    createdAt: s.createdAt.toISOString(),
    paymentMethods: allPayments
      .filter((p) => p.saleId === s.id)
      .map((p) => p.method),
  }));
}

router.post(
  "/",
  requireRole("CASHIER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { orderId, payments: pays } = req.body ?? {};
    if (!orderId || !Array.isArray(pays) || pays.length === 0)
      return res.status(400).json({ error: "orderId y pagos son requeridos" });

    const saleId = await db.transaction(async (tx) => {
      const order = (
        await tx.select().from(orders).where(eq(orders.id, Number(orderId)))
      )[0];
      if (!order) throw Object.assign(new Error("Orden no encontrada"), { status: 404 });
      if (order.status === "paid") throw Object.assign(new Error("Esta orden ya fue pagada"), { status: 409 });

      // Verificar que la mesa solicitó el pago
      const table = (await tx.select().from(restaurantTables).where(eq(restaurantTables.id, order.tableId)))[0];
      if (!table) throw Object.assign(new Error("Mesa no encontrada"), { status: 404 });
      if (table.status !== "waiting_payment") {
        throw Object.assign(new Error("La mesa aún no ha solicitado el pago"), { status: 409 });
      }

      const items = await tx
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          productName: products.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
        })
        .from(orderItems)
        .leftJoin(products, eq(products.id, orderItems.productId))
        .where(eq(orderItems.orderId, order.id));

      if (items.length === 0) throw new Error("La orden no tiene items");

      const subtotal = items.reduce(
        (s, it) => s + Number(it.unitPrice) * it.quantity,
        0,
      );

      // El total pagado puede incluir propina — debe ser >= subtotal
      const paymentSum = pays.reduce(
        (s: number, p: { amount: number }) => s + Number(p.amount),
        0,
      );
      if (paymentSum < subtotal - 0.01) {
        throw Object.assign(
          new Error(`Monto insuficiente. Total: Q${subtotal.toFixed(2)}, pagado: Q${paymentSum.toFixed(2)}`),
          { status: 400 }
        );
      }

      // El total guardado es lo que realmente se cobró (con propina)
      const total = paymentSum;

      const [sale] = await tx
        .insert(sales)
        .values({
          orderId: order.id,
          tableId: order.tableId,
          waiterId: order.waiterId,
          cashierId: req.auth!.userId,
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
        })
        .returning();

      await tx.insert(saleItems).values(
        items.map((it) => ({
          saleId: sale.id,
          productId: it.productId,
          productName: it.productName ?? "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: (Number(it.unitPrice) * it.quantity).toFixed(2),
        })),
      );

      await tx.insert(payments).values(
        pays.map((p: { method: string; amount: number }) => ({
          saleId: sale.id,
          method: p.method as "cash" | "card" | "transfer",
          amount: Number(p.amount).toFixed(2),
        })),
      );

      // Descontar inventario via receta
      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      const recipeRows = await tx
        .select()
        .from(recipes)
        .where(inArray(recipes.productId, productIds));
      const recipeByProduct = new Map(recipeRows.map((r) => [r.productId, r.id]));
      const recipeIds = recipeRows.map((r) => r.id);
      const ingRows =
        recipeIds.length > 0
          ? await tx
              .select()
              .from(recipeIngredients)
              .where(inArray(recipeIngredients.recipeId, recipeIds))
          : [];
      const deductions = new Map<number, number>();
      for (const it of items) {
        const recipeId = recipeByProduct.get(it.productId);
        if (!recipeId) continue;
        const itemRecipes = ingRows.filter((r) => r.recipeId === recipeId);
        for (const r of itemRecipes) {
          const totalQty = Number(r.quantity) * it.quantity;
          deductions.set(
            r.inventoryItemId,
            (deductions.get(r.inventoryItemId) ?? 0) + totalQty,
          );
        }
      }
      for (const [invId, qty] of deductions.entries()) {
        await tx
          .update(inventoryItems)
          .set({
            currentQuantity: sql`${inventoryItems.currentQuantity} - ${qty.toString()}`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, invId));
        await tx.insert(inventoryMovements).values({
          inventoryItemId: invId,
          change: (-qty).toString(),
          reason: `Venta #${sale.id}`,
          saleId: sale.id,
          userId: req.auth!.userId,
        });
      }

      await tx
        .update(orders)
        .set({ status: "paid" })
        .where(eq(orders.id, order.id));
      await tx
        .update(kitchenTickets)
        .set({ status: "delivered", updatedAt: new Date() })
        .where(eq(kitchenTickets.orderId, order.id));
      await tx
        .update(restaurantTables)
        .set({ status: "free", openedAt: null, openedByUserId: null })
        .where(eq(restaurantTables.id, order.tableId));

      // Actualizar cierre del día
      const today = localDateIso();
      const [todayExp] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}),0)` })
        .from(expenses)
        .where(eq(expenses.expenseDate, today));
      const [todaySales] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${sales.total}),0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(sales)
        .where(gte(sales.createdAt, new Date(`${today}T00:00:00`)));
      const totalSalesNow = Number(todaySales?.total ?? 0);
      const totalExpensesNow = Number(todayExp?.total ?? 0);
      await tx
        .insert(dailyCloses)
        .values({
          closeDate: today,
          totalSales: totalSalesNow.toFixed(2),
          totalExpenses: totalExpensesNow.toFixed(2),
          netProfit: (totalSalesNow - totalExpensesNow).toFixed(2),
          transactionCount: Number(todaySales?.count ?? 0),
          finalized: false,
          payload: {},
        })
        .onConflictDoUpdate({
          target: dailyCloses.closeDate,
          set: {
            totalSales: totalSalesNow.toFixed(2),
            totalExpenses: totalExpensesNow.toFixed(2),
            netProfit: (totalSalesNow - totalExpensesNow).toFixed(2),
            transactionCount: Number(todaySales?.count ?? 0),
            updatedAt: new Date(),
          },
        });

      return sale.id;
    });

    const [s] = await db.select().from(sales).where(eq(sales.id, saleId));
    const [mapped] = await mapSales([s]);
    res.json(mapped);
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = [];
    if (req.query.from) where.push(gte(sales.createdAt, new Date(String(req.query.from))));
    if (req.query.to) where.push(lte(sales.createdAt, new Date(String(req.query.to) + "T23:59:59")));
    const rows = await db
      .select()
      .from(sales)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(sales.createdAt))
      .limit(500);
    res.json(await mapSales(rows));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [s] = await db.select().from(sales).where(eq(sales.id, id));
    if (!s) return res.status(404).json({ error: "Not found" });
    const [base] = await mapSales([s]);
    const items = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, id));
    const pays = await db
      .select()
      .from(payments)
      .where(eq(payments.saleId, id));
    res.json({
      ...base,
      items: items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      })),
      payments: pays.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
    });
  }),
);

// ADMIN: Anular una venta
router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [s] = await db.select().from(sales).where(eq(sales.id, id));
    if (!s) return res.status(404).json({ error: "Venta no encontrada" });
    await db.delete(payments).where(eq(payments.saleId, id));
    await db.delete(saleItems).where(eq(saleItems.saleId, id));
    await db.delete(sales).where(eq(sales.id, id));
    res.json({ ok: true });
  }),
);

export default router;
