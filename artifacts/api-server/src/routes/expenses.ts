import { Router, type IRouter } from "express";
import { db, expenses, users } from "@workspace/db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = [];
    if (req.query.from) where.push(gte(expenses.expenseDate, String(req.query.from)));
    if (req.query.to) where.push(lte(expenses.expenseDate, String(req.query.to)));
    if (req.query.category)
      where.push(eq(expenses.category, req.query.category as never));
    const rows = await db
      .select({
        id: expenses.id,
        name: expenses.name,
        description: expenses.description,
        amount: expenses.amount,
        category: expenses.category,
        supplier: expenses.supplier,
        expenseDate: expenses.expenseDate,
        invoiceNumber: expenses.invoiceNumber,
        paymentMethod: expenses.paymentMethod,
        createdByName: users.name,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(users, eq(users.id, expenses.createdById))
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(expenses.expenseDate), desc(expenses.id));
    res.json(
      rows.map((e) => ({
        ...e,
        amount: Number(e.amount),
        createdAt: e.createdAt.toISOString(),
      })),
    );
  }),
);

router.post(
  "/",
  requireRole("ADMIN", "CASHIER"),
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      amount,
      category,
      supplier,
      expenseDate,
      invoiceNumber,
      paymentMethod,
    } = req.body ?? {};
    if (!name || amount === undefined || !category || !expenseDate)
      return res.status(400).json({ error: "missing required fields" });
    const [created] = await db
      .insert(expenses)
      .values({
        name: String(name),
        description: description ?? null,
        amount: String(amount),
        category,
        supplier: supplier ?? null,
        expenseDate: String(expenseDate),
        invoiceNumber: invoiceNumber ?? null,
        paymentMethod: paymentMethod ?? "cash",
        createdById: req.auth!.userId,
      })
      .returning();
    res.json({
      ...created,
      amount: Number(created.amount),
      createdAt: created.createdAt.toISOString(),
      createdByName: req.auth!.name,
    });
  }),
);

router.put(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const {
      name,
      description,
      amount,
      category,
      supplier,
      expenseDate,
      invoiceNumber,
      paymentMethod,
    } = req.body ?? {};
    const updates: Partial<typeof expenses.$inferInsert> = {};
    if (name !== undefined) updates.name = String(name);
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = String(amount);
    if (category !== undefined) updates.category = category;
    if (supplier !== undefined) updates.supplier = supplier;
    if (expenseDate !== undefined) updates.expenseDate = String(expenseDate);
    if (invoiceNumber !== undefined) updates.invoiceNumber = invoiceNumber;
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
    const [updated] = await db
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({
      ...updated,
      amount: Number(updated.amount),
      createdAt: updated.createdAt.toISOString(),
      createdByName: null,
    });
  }),
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await db.delete(expenses).where(eq(expenses.id, Number(req.params.id)));
    res.json({ ok: true });
  }),
);

export default router;
