import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryPurchases, inventoryPurchaseItems, inventoryItems, inventoryMovements, expenses } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();
router.use(requireAuth);

// Listar facturas de compra
router.get("/", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(inventoryPurchases).orderBy(desc(inventoryPurchases.purchaseDate));
  const withItems = await Promise.all(rows.map(async (p) => {
    const items = await db.select({
      id: inventoryPurchaseItems.id,
      inventoryItemId: inventoryPurchaseItems.inventoryItemId,
      inventoryItemName: inventoryItems.name,
      quantity: inventoryPurchaseItems.quantity,
      unit: inventoryItems.unit,
      unitCost: inventoryPurchaseItems.unitCost,
      totalCost: inventoryPurchaseItems.totalCost,
    })
    .from(inventoryPurchaseItems)
    .leftJoin(inventoryItems, eq(inventoryItems.id, inventoryPurchaseItems.inventoryItemId))
    .where(eq(inventoryPurchaseItems.purchaseId, p.id));
    return { ...p, items };
  }));
  res.json(withItems);
}));

// Crear factura de compra y actualizar inventario
router.post("/", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const { supplier, purchaseDate, notes, items } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Debe incluir al menos un producto" });
  }

  const result = await db.transaction(async (tx) => {
    const totalAmount = items.reduce((sum: number, item: { quantity: number; unitCost: number }) =>
      sum + (Number(item.quantity) * Number(item.unitCost)), 0);

    const [purchase] = await tx.insert(inventoryPurchases).values({
      supplier: supplier || null,
      purchaseDate: purchaseDate || new Date().toISOString().split("T")[0],
      totalAmount: String(totalAmount),
      notes: notes || null,
    }).returning();

    for (const item of items) {
      const qty = Number(item.quantity);
      const cost = Number(item.unitCost);
      const total = qty * cost;

      await tx.insert(inventoryPurchaseItems).values({
        purchaseId: purchase.id,
        inventoryItemId: Number(item.inventoryItemId),
        quantity: String(qty),
        unitCost: String(cost),
        totalCost: String(total),
      });

      // Actualizar inventario — sumar cantidad y actualizar costo unitario
      const [current] = await tx.select().from(inventoryItems)
        .where(eq(inventoryItems.id, Number(item.inventoryItemId)));

      if (current) {
        const newQty = Number(current.currentQuantity) + qty;
        await tx.update(inventoryItems)
          .set({ currentQuantity: String(newQty), cost: String(cost), updatedAt: new Date() })
          .where(eq(inventoryItems.id, Number(item.inventoryItemId)));

        await tx.insert(inventoryMovements).values({
          inventoryItemId: Number(item.inventoryItemId),
          change: String(qty),
          reason: `Compra: ${supplier || "Sin proveedor"} — Factura #${purchase.id}`,
        });
      }
    }


      // Registrar automáticamente como gasto
      await tx.insert(expenses).values({
        name: `Compra inventario — ${supplier || "Sin proveedor"}`,
        amount: String(totalAmount),
        category: "food_supplies" as const,
        supplier: supplier || null,
        expenseDate: purchaseDate || new Date().toISOString().split("T")[0],
        paymentMethod: "cash" as const,
        description: `Factura #${purchase.id}${notes ? " — " + notes : ""}`,
      });
    return purchase;
  });

  res.status(201).json(result);
}));

// Ver detalle de una factura
router.get("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const purchase = (await db.select().from(inventoryPurchases).where(eq(inventoryPurchases.id, id)))[0];
  if (!purchase) return res.status(404).json({ error: "Factura no encontrada" });

  const items = await db.select({
    id: inventoryPurchaseItems.id,
    inventoryItemId: inventoryPurchaseItems.inventoryItemId,
    inventoryItemName: inventoryItems.name,
    quantity: inventoryPurchaseItems.quantity,
    unit: inventoryItems.unit,
    unitCost: inventoryPurchaseItems.unitCost,
    totalCost: inventoryPurchaseItems.totalCost,
  })
  .from(inventoryPurchaseItems)
  .leftJoin(inventoryItems, eq(inventoryItems.id, inventoryPurchaseItems.inventoryItemId))
  .where(eq(inventoryPurchaseItems.purchaseId, id));

  res.json({ ...purchase, items });
}));

export default router;

// ADMIN: Eliminar factura de compra y su gasto asociado
router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const purchase = (await db.select().from(inventoryPurchases).where(eq(inventoryPurchases.id, id)))[0];
    if (!purchase) return res.status(404).json({ error: "Factura no encontrada" });
    await db.transaction(async (tx) => {
      // Borrar el gasto asociado que se creó automáticamente
      await tx.delete(expenses).where(
        sql`description LIKE ${"Factura #" + id + "%"}`
      );
      // Borrar items y factura
      await tx.delete(inventoryPurchaseItems).where(eq(inventoryPurchaseItems.purchaseId, id));
      await tx.delete(inventoryPurchases).where(eq(inventoryPurchases.id, id));
    });
    res.json({ ok: true });
  }),
);
