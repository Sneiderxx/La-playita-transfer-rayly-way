import { Router, type IRouter } from "express";
import {
  db,
  kitchenTickets,
  orders,
  orderItems,
  products,
  restaurantTables,
  areas,
  users,
} from "@workspace/db";
import { asc, eq, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

router.get(
  "/tickets",
  asyncHandler(async (_req, res) => {
    const tickets = await db
      .select({
        id: kitchenTickets.id,
        orderId: kitchenTickets.orderId,
        status: kitchenTickets.status,
        createdAt: kitchenTickets.createdAt,
        tableNumber: restaurantTables.number,
        areaName: areas.name,
        waiterName: users.name,
      })
      .from(kitchenTickets)
      .leftJoin(orders, eq(orders.id, kitchenTickets.orderId))
      .leftJoin(restaurantTables, eq(restaurantTables.id, orders.tableId))
      .leftJoin(areas, eq(areas.id, restaurantTables.areaId))
      .leftJoin(users, eq(users.id, orders.waiterId))
      .where(ne(kitchenTickets.status, "delivered"))
      .orderBy(asc(kitchenTickets.createdAt));

    const out = [];
    for (const t of tickets) {
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
        .where(eq(orderItems.orderId, t.orderId));
      out.push({
        id: t.id,
        orderId: t.orderId,
        tableNumber: t.tableNumber ?? 0,
        areaName: t.areaName ?? "",
        waiterName: t.waiterName ?? "",
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        items: items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName ?? "",
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          notes: it.notes,
          lineTotal: Number(it.unitPrice) * it.quantity,
        })),
      });
    }
    res.json(out);
  }),
);

const TICKET_FLOW = ["pending", "preparing", "ready", "delivered"] as const;
type TicketStatus = (typeof TICKET_FLOW)[number];

router.patch(
  "/tickets/:id/status",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status as TicketStatus;
    if (!TICKET_FLOW.includes(status))
      return res.status(400).json({ error: "invalid status" });
    const current = (
      await db.select().from(kitchenTickets).where(eq(kitchenTickets.id, id))
    )[0];
    if (!current) return res.status(404).json({ error: "Not found" });

    const fromIdx = TICKET_FLOW.indexOf(current.status as TicketStatus);
    const toIdx = TICKET_FLOW.indexOf(status);
    if (toIdx !== fromIdx + 1 && !(fromIdx === toIdx)) {
      return res.status(409).json({
        error: `Invalid transition: ${current.status} -> ${status}. Tickets must advance one step at a time.`,
      });
    }

    const [updated] = await db
      .update(kitchenTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(kitchenTickets.id, id))
      .returning();

    const meta = (
      await db
        .select({
          tableNumber: restaurantTables.number,
          areaName: areas.name,
          waiterName: users.name,
        })
        .from(orders)
        .leftJoin(restaurantTables, eq(restaurantTables.id, orders.tableId))
        .leftJoin(areas, eq(areas.id, restaurantTables.areaId))
        .leftJoin(users, eq(users.id, orders.waiterId))
        .where(eq(orders.id, updated.orderId))
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
      .where(eq(orderItems.orderId, updated.orderId));

    res.json({
      id: updated.id,
      orderId: updated.orderId,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      tableNumber: meta?.tableNumber ?? 0,
      areaName: meta?.areaName ?? "",
      waiterName: meta?.waiterName ?? "",
      items: items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName ?? "",
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        notes: it.notes,
        lineTotal: Number(it.unitPrice) * it.quantity,
      })),
    });
  }),
);

export default router;
