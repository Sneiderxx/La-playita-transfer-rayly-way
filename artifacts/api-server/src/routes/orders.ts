import { Router, type IRouter } from "express";
import {
  db,
  orders,
  orderItems,
  products,
  restaurantTables,
  areas,
  users,
  kitchenTickets,
  sales,
  saleItems,
  payments,
  inventoryMovements,
  dailyCloses,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

async function loadOrderDetail(orderId: number) {
  const order = (
    await db.select().from(orders).where(eq(orders.id, orderId))
  )[0];
  if (!order) return null;
  const table = (
    await db
      .select({
        number: restaurantTables.number,
        areaName: areas.name,
      })
      .from(restaurantTables)
      .leftJoin(areas, eq(areas.id, restaurantTables.areaId))
      .where(eq(restaurantTables.id, order.tableId))
  )[0];
  const waiter = (
    await db.select().from(users).where(eq(users.id, order.waiterId))
  )[0];
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: products.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      notes: orderItems.notes,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id));
  const itemDetails = items.map((it) => ({
    id: it.id,
    productId: it.productId,
    productName: it.productName ?? "",
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
    notes: it.notes,
    lineTotal: Number(it.unitPrice) * it.quantity,
  }));
  return {
    id: order.id,
    tableId: order.tableId,
    tableNumber: table?.number ?? 0,
    areaName: table?.areaName ?? "",
    waiterId: order.waiterId,
    waiterName: waiter?.name ?? "",
    status: order.status,
    total: itemDetails.reduce((s, i) => s + i.lineTotal, 0),
    items: itemDetails,
    createdAt: order.createdAt.toISOString(),
  };
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { tableId, items } = req.body ?? {};
    if (!tableId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "tableId and items required" });
    }
    const orderId = await db.transaction(async (tx) => {
      const table = (
        await tx
          .select()
          .from(restaurantTables)
          .where(eq(restaurantTables.id, Number(tableId)))
      )[0];
      if (!table) throw new Error("Table not found");

      let order = (
        await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.tableId, Number(tableId)),
              inArray(orders.status, ["open", "sent"]),
            ),
          )
      )[0];
      if (!order) {
        const [created] = await tx
          .insert(orders)
          .values({
            tableId: Number(tableId),
            waiterId: req.auth!.userId,
            status: "open",
          })
          .returning();
        order = created;
        if (table.status === "free") {
          await tx
            .update(restaurantTables)
            .set({
              status: "occupied",
              openedAt: new Date(),
              openedByUserId: req.auth!.userId,
            })
            .where(eq(restaurantTables.id, Number(tableId)));
        }
      }

      const productIds = items.map((i: { productId: number }) =>
        Number(i.productId),
      );
      const prodRows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));
      const priceMap = new Map(prodRows.map((p) => [p.id, p.price]));

      await tx.insert(orderItems).values(
        items.map(
          (i: { productId: number; quantity: number; notes?: string }) => ({
            orderId: order.id,
            productId: Number(i.productId),
            quantity: Number(i.quantity),
            unitPrice: priceMap.get(Number(i.productId)) ?? "0",
            notes: i.notes ?? null,
          }),
        ),
      );

      await tx
        .update(orders)
        .set({ status: "sent" })
        .where(eq(orders.id, order.id));

      await tx.insert(kitchenTickets).values({
        orderId: order.id,
        status: "pending",
      });

      return order.id;
    });
    res.json(await loadOrderDetail(orderId));
  }),
);

router.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.status, ["open", "sent"]))
      .orderBy(desc(orders.createdAt));
    const out = [];
    for (const r of rows) {
      const d = await loadOrderDetail(r.id);
      if (d) out.push(d);
    }
    res.json(out);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const d = await loadOrderDetail(Number(req.params.id));
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  }),
);

router.patch(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const add: Array<{ productId: number; quantity: number; notes?: string }> =
      req.body?.add ?? [];
    const remove: number[] = req.body?.remove ?? [];
    if (add.length === 0 && remove.length === 0) {
      return res.status(400).json({ error: "add or remove required" });
    }
    await db.transaction(async (tx) => {
      if (remove.length > 0) {
        await tx
          .delete(orderItems)
          .where(
            and(
              eq(orderItems.orderId, orderId),
              inArray(orderItems.id, remove.map(Number)),
            ),
          );
      }
      if (add.length > 0) {
        const productIds = add.map((i) => Number(i.productId));
        const prodRows = await tx
          .select()
          .from(products)
          .where(inArray(products.id, productIds));
        const priceMap = new Map(prodRows.map((p) => [p.id, p.price]));
        await tx.insert(orderItems).values(
          add.map((i) => ({
            orderId,
            productId: Number(i.productId),
            quantity: Number(i.quantity),
            unitPrice: priceMap.get(Number(i.productId)) ?? "0",
            notes: i.notes ?? null,
          })),
        );
        await tx
          .update(orders)
          .set({ status: "sent" })
          .where(eq(orders.id, orderId));
        const existing = (
          await tx
            .select()
            .from(kitchenTickets)
            .where(eq(kitchenTickets.orderId, orderId))
        )[0];
        if (!existing) {
          await tx
            .insert(kitchenTickets)
            .values({ orderId, status: "pending" });
        } else if (existing.status !== "pending") {
          await tx
            .update(kitchenTickets)
            .set({ status: "pending", updatedAt: new Date() })
            .where(eq(kitchenTickets.id, existing.id));
        }
      }
    });
    res.json(await loadOrderDetail(orderId));
  }),
);

export default router;

// ── ADMIN: Listar TODAS las órdenes con filtros ─────────────────────────────
router.get(
  "/history/all",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const status = req.query.status as string | undefined;
    const where = status ? eq(orders.status, status as "open" | "sent" | "paid" | "void") : undefined;
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    const out = [];
    for (const r of rows) {
      const d = await loadOrderDetail(r.id);
      if (d) out.push(d);
    }
    res.json(out);
  }),
);

// ── ADMIN: Cambiar estado de una orden ──────────────────────────────────────
router.patch(
  "/:id/status",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const { status } = req.body ?? {};
    const allowed = ["open", "sent", "paid", "void"] as const;
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Estado inválido" });
    }
    const [updated] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(await loadOrderDetail(orderId));
  }),
);


// ── ADMIN: Eliminar permanentemente una orden ───────────────────────────────
router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    await db.transaction(async (tx) => {
      const order = (await tx.select().from(orders).where(eq(orders.id, orderId)))[0];
      if (!order) throw Object.assign(new Error("Orden no encontrada"), { status: 404 });

      // Borrar venta asociada si existe
      const relatedSales = await tx.select().from(sales).where(eq(sales.orderId, orderId));
      for (const sale of relatedSales) {
        await tx.delete(inventoryMovements).where(eq(inventoryMovements.saleId, sale.id));
        await tx.delete(payments).where(eq(payments.saleId, sale.id));
        await tx.delete(saleItems).where(eq(saleItems.saleId, sale.id));
        await tx.delete(sales).where(eq(sales.id, sale.id));
      }

      // Borrar ticket cocina, items y orden
      await tx.delete(kitchenTickets).where(eq(kitchenTickets.orderId, orderId));
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.delete(orders).where(eq(orders.id, orderId));

      // Liberar mesa si no tiene otras ordenes activas
      const otherActive = await tx.select({ id: orders.id }).from(orders)
        .where(and(eq(orders.tableId, order.tableId), inArray(orders.status, ["open", "sent"])));
      if (otherActive.length === 0) {
        await tx.update(restaurantTables)
          .set({ status: "free", openedAt: null, openedByUserId: null })
          .where(eq(restaurantTables.id, order.tableId));
      }

      // Recalcular cierre del dia
      const today = new Date().toISOString().split("T")[0];
      const [todaySales] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${sales.total}),0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(sales)
        .where(gte(sales.createdAt, new Date(today + "T00:00:00")));
      await tx
        .update(dailyCloses)
        .set({
          totalSales: (Number(todaySales?.total ?? 0)).toFixed(2),
          transactionCount: Number(todaySales?.count ?? 0),
          updatedAt: new Date(),
        })
        .where(eq(dailyCloses.closeDate, today));
    });
    res.json({ ok: true });
  }),
);
