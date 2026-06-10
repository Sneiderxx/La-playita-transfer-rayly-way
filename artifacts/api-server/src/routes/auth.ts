import { Router, type IRouter } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  signToken,
  verifyPassword,
  requireAuth,
} from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { name, password } = req.body ?? {};
    if (!name || !password) {
      return res.status(400).json({ error: "name and password required" });
    }
    const found = await db
      .select()
      .from(users)
      .where(eq(users.name, String(name)));
    const user = found[0];
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken({
      userId: user.id,
      role: user.role,
      name: user.name,
    });
    return res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, active: user.active },
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const found = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth!.userId));
    const u = found[0];
    if (!u) return res.status(404).json({ error: "Not found" });
    return res.json({ id: u.id, name: u.name, role: u.role, active: u.active });
  }),
);

export default router;
