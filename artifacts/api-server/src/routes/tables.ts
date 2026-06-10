import { Router, type IRouter } from "express";
import {
  db,
  restaurantTables,
  areas,
  users,
  orders,
  orderItems,
  products,
} from "@workspace/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

const ALLOWED_STATUSES = ["free", "occupied", "waiting_payment", "closed"] as const;
type TableStatus = (typeof ALLOWED_STATUSES)[number];

async function listAllTables() {
  const rows = await db
    .select({
      id: restaurantTables.id,
      areaId: restaurantTables.areaId,
      areaName: areas.name,
      number: restaurantTables.number,
      status: restaurantTables.status,
      openedAt: restaurantTables.openedAt,
      openedByName: users.name,
    })
    .from(restaurantTables)
    .leftJoin(areas, eq(areas.id, restaurantTables.areaId))
    .leftJoin(users, eq(users.id, restaurantTables.openedByUserId))
    .orderBy(asc(restaurantTables.areaId), asc(restaurantTables.number));

  const openOrders = await db
    .select({
      id: orders.id,
      tableId: orders.tableId,
      total: sql<string>`COALESCE(SUM(${orderItems.unitPrice} * ${orderItems.quantity}), 0)`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.status, ["open", "sent"]))
    .groupBy(orders.id, orders.tableId);

  const byTable = new Map<number, { id: number; total: number }>();
  for (const o of openOrders) {
    byTable.set(o.tableId, { id: o.id, total: Number(o.total) });
  }

  return rows.map((r) => ({
    id: r.id,
    areaId: r.areaId,
    areaName: r.areaName ?? "",
    number: r.number,
    status: r.status,
    openedAt: r.openedAt?.toISOString() ?? null,
    openedByName: r.openedByName,
    currentOrderId: byTable.get(r.id)?.id ?? null,
    currentTotal: byTable.get(r.id)?.total ?? 0,
  }));
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listAllTables());
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const all = await listAllTables();
    const table = all.find((t) => t.id === id);
    if (!table) return res.status(404).json({ error: "Not found" });

    let order = null;
    if (table.currentOrderId) {
      const o = (
        await db.select().from(orders).where(eq(orders.id, table.currentOrderId))
      )[0];
      if (o) {
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
          .where(eq(orderItems.orderId, o.id));
        const waiter = (
          await db.select().from(users).where(eq(users.id, o.waiterId))
        )[0];
        order = {
          id: o.id,
          tableId: o.tableId,
          tableNumber: table.number,
          areaName: table.areaName,
          waiterId: o.waiterId,
          waiterName: waiter?.name ?? "",
          status: o.status,
          total: items.reduce(
            (sum, it) => sum + Number(it.unitPrice) * it.quantity,
            0,
          ),
          items: items.map((it) => ({
            id: it.id,
            productId: it.productId,
            productName: it.productName ?? "",
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
            notes: it.notes,
            lineTotal: Number(it.unitPrice) * it.quantity,
          })),
          createdAt: o.createdAt.toISOString(),
        };
      }
    }
    return res.json({ ...table, order });
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status as TableStatus;
    if (!ALLOWED_STATUSES.includes(status))
      return res.status(400).json({ error: "invalid status" });
    const updates: Partial<typeof restaurantTables.$inferInsert> = { status };
    if (status === "free") {
      updates.openedAt = null;
      updates.openedByUserId = null;
    } else if (status === "occupied") {
      updates.openedAt = new Date();
      updates.openedByUserId = req.auth!.userId;
    }
    const [updated] = await db
      .update(restaurantTables)
      .set(updates)
      .where(eq(restaurantTables.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    const all = await listAllTables();
    res.json(all.find((t) => t.id === id));
  }),
);

router.post(
  "/:id/open",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(restaurantTables)
      .set({
        status: "occupied",
        openedAt: new Date(),
        openedByUserId: req.auth!.userId,
      })
      .where(
        and(eq(restaurantTables.id, id), eq(restaurantTables.status, "free")),
      )
      .returning();
    if (!updated) {
      return res.status(409).json({ error: "Table not free" });
    }
    const all = await listAllTables();
    return res.json(all.find((t) => t.id === id));
  }),
);

router.post(
  "/:id/transfer",
  asyncHandler(async (req, res) => {
    const fromId = Number(req.params.id);
    const targetTableId = Number(req.body?.targetTableId);
    if (!targetTableId)
      return res.status(400).json({ error: "targetTableId required" });

    await db.transaction(async (tx) => {
      const target = (
        await tx
          .select()
          .from(restaurantTables)
          .where(eq(restaurantTables.id, targetTableId))
      )[0];
      if (!target || target.status !== "free") {
        throw new Error("Target table not free");
      }
      const from = (
        await tx
          .select()
          .from(restaurantTables)
          .where(eq(restaurantTables.id, fromId))
      )[0];
      if (!from) throw new Error("Source table not found");

      await tx
        .update(orders)
        .set({ tableId: targetTableId })
        .where(
          and(
            eq(orders.tableId, fromId),
            inArray(orders.status, ["open", "sent"]),
          ),
        );
      await tx
        .update(restaurantTables)
        .set({
          status: from.status,
          openedAt: from.openedAt,
          openedByUserId: from.openedByUserId,
        })
        .where(eq(restaurantTables.id, targetTableId));
      await tx
        .update(restaurantTables)
        .set({ status: "free", openedAt: null, openedByUserId: null })
        .where(eq(restaurantTables.id, fromId));
    });
    res.json({ ok: true });
  }),
);

export default router;
