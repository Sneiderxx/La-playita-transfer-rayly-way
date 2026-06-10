import { Router, type IRouter } from "express";
import { db, users } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { hashPassword, requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();

const publicUser = (u: typeof users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  role: u.role,
  active: u.active,
});

router.use(requireAuth, requireRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(users).orderBy(asc(users.name));
    res.json(rows.map(publicUser));
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, password, role, active } = req.body ?? {};
    if (!name || !password || !role) {
      return res.status(400).json({ error: "name, password, role required" });
    }
    const hash = await hashPassword(String(password));
    const [created] = await db
      .insert(users)
      .values({
        name: String(name),
        passwordHash: hash,
        role,
        active: active ?? true,
      })
      .returning();
    return res.json(publicUser(created));
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, password, role, active } = req.body ?? {};
    const updates: Partial<typeof users.$inferInsert> = {};
    if (name !== undefined) updates.name = String(name);
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = Boolean(active);
    if (password) updates.passwordHash = await hashPassword(String(password));
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(publicUser(updated));
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await db
      .update(users)
      .set({ active: false })
      .where(eq(users.id, id));
    res.json({ ok: true });
  }),
);

export default router;
