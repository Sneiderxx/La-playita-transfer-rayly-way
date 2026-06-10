import { Router } from "express";
import { db } from "@workspace/db";
import { fixedCosts } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();
router.use(requireAuth);

// Listar gastos fijos
router.get("/", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(fixedCosts).orderBy(fixedCosts.name);
  res.json(rows);
}));

// Crear gasto fijo
router.post("/", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const { name, category, monthlyAmount } = req.body;
  if (!name || !category || !monthlyAmount) {
    return res.status(400).json({ error: "nombre, categoría y monto mensual son requeridos" });
  }
  const [row] = await db.insert(fixedCosts).values({
    name,
    category,
    monthlyAmount: String(monthlyAmount),
    active: true,
  }).returning();
  res.status(201).json(row);
}));

// Actualizar gasto fijo
router.put("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { name, category, monthlyAmount, active } = req.body;
  const [row] = await db.update(fixedCosts)
    .set({ name, category, monthlyAmount: monthlyAmount ? String(monthlyAmount) : undefined, active })
    .where(eq(fixedCosts.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Gasto fijo no encontrado" });
  res.json(row);
}));

// Eliminar gasto fijo
router.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(fixedCosts).where(eq(fixedCosts.id, id));
  res.json({ ok: true });
}));

// Obtener costo fijo diario total
router.get("/daily-total", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(fixedCosts).where(eq(fixedCosts.active, true));
  const monthlyTotal = rows.reduce((sum, r) => sum + Number(r.monthlyAmount), 0);
  const dailyTotal = monthlyTotal / 30;
  res.json({ monthlyTotal, dailyTotal, items: rows });
}));

export default router;
