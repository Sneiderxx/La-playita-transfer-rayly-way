import { Router, type IRouter } from "express";
import {
  db,
  categories,
  products,
  inventoryItems,
  inventoryMovements,
  recipes,
  recipeIngredients,
} from "@workspace/db";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";

export const categoriesRouter: IRouter = Router();
categoriesRouter.use(requireAuth);
categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
    );
  }),
);
categoriesRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { name, sortOrder } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "name required" });
    const [created] = await db
      .insert(categories)
      .values({ name: String(name), sortOrder: Number(sortOrder ?? 0) })
      .returning();
    res.json(created);
  }),
);

export const productsRouter: IRouter = Router();
productsRouter.use(requireAuth);

async function fetchProducts() {
  const rows = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      categoryName: categories.name,
      name: products.name,
      description: products.description,
      price: products.price,
      salePrice: products.salePrice,
      variants: products.variants,
      imageUrl: products.imageUrl,
      active: products.active,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(asc(products.name));
  return rows.map((p) => ({ ...p, price: Number(p.price), salePrice: p.salePrice ? Number(p.salePrice) : null, variants: p.variants ?? null, categoryName: p.categoryName ?? "" }));
}

productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => res.json(await fetchProducts())),
);
productsRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { categoryId, name, description, price, imageUrl, active } =
      req.body ?? {};
    if (!categoryId || !name || price === undefined)
      return res.status(400).json({ error: "categoryId, name, price required" });
    const [created] = await db
      .insert(products)
      .values({
        categoryId: Number(categoryId),
        name: String(name),
        description: description ?? null,
        price: String(price),
        imageUrl: imageUrl ?? null,
        active: active ?? true,
      })
      .returning();
    res.json({ ...created, price: Number(created.price) });
  }),
);
productsRouter.put(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { categoryId, name, description, price, sale_price, variants, imageUrl, active } =
      req.body ?? {};
    const updates: Partial<typeof products.$inferInsert> = {};
    if (categoryId !== undefined) updates.categoryId = Number(categoryId);
    if (name !== undefined) updates.name = String(name);
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = String(price);
    if (sale_price !== undefined) updates.salePrice = sale_price !== null ? String(sale_price) : null;
    if (variants !== undefined) updates.variants = variants;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (active !== undefined) updates.active = Boolean(active);
    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ ...updated, price: Number(updated.price), salePrice: updated.salePrice ? Number(updated.salePrice) : null, variants: updated.variants ?? null });
  }),
);
productsRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await db.update(products).set({ active: false }).where(eq(products.id, id));
    res.json({ ok: true });
  }),
);

export const recipesRouter: IRouter = Router();
recipesRouter.use(requireAuth);

async function fetchIngredients(recipeId: number) {
  const rows = await db
    .select({
      id: recipeIngredients.id,
      recipeId: recipeIngredients.recipeId,
      inventoryItemId: recipeIngredients.inventoryItemId,
      inventoryItemName: inventoryItems.name,
      unit: inventoryItems.unit,
      quantity: recipeIngredients.quantity,
    })
    .from(recipeIngredients)
    .leftJoin(
      inventoryItems,
      eq(inventoryItems.id, recipeIngredients.inventoryItemId),
    )
    .where(eq(recipeIngredients.recipeId, recipeId));
  return rows.map((r) => ({
    id: r.id,
    recipeId: r.recipeId,
    inventoryItemId: r.inventoryItemId,
    inventoryItemName: r.inventoryItemName ?? "",
    unit: r.unit ?? "",
    quantity: Number(r.quantity),
  }));
}

recipesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: recipes.id,
        productId: recipes.productId,
        productName: products.name,
        notes: recipes.notes,
      })
      .from(recipes)
      .leftJoin(products, eq(products.id, recipes.productId))
      .orderBy(asc(products.name));
    const out = [];
    for (const r of rows) {
      const ings = await fetchIngredients(r.id);
      out.push({
        id: r.id,
        productId: r.productId,
        productName: r.productName ?? "",
        notes: r.notes,
        ingredientCount: ings.length,
        ingredients: ings,
      });
    }
    res.json(out);
  }),
);

recipesRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { productId, notes } = req.body ?? {};
    if (!productId) return res.status(400).json({ error: "productId required" });
    const existing = (
      await db.select().from(recipes).where(eq(recipes.productId, Number(productId)))
    )[0];
    if (existing) return res.status(409).json({ error: "Recipe already exists for product" });
    const [created] = await db
      .insert(recipes)
      .values({ productId: Number(productId), notes: notes ?? null })
      .returning();
    const product = (
      await db.select().from(products).where(eq(products.id, created.productId))
    )[0];
    res.json({
      id: created.id,
      productId: created.productId,
      productName: product?.name ?? "",
      notes: created.notes,
      ingredientCount: 0,
      ingredients: [],
    });
  }),
);

recipesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const r = (await db.select().from(recipes).where(eq(recipes.id, id)))[0];
    if (!r) return res.status(404).json({ error: "Not found" });
    const product = (
      await db.select().from(products).where(eq(products.id, r.productId))
    )[0];
    const ings = await fetchIngredients(id);
    res.json({
      id: r.id,
      productId: r.productId,
      productName: product?.name ?? "",
      notes: r.notes,
      ingredientCount: ings.length,
      ingredients: ings,
    });
  }),
);

recipesRouter.put(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { notes } = req.body ?? {};
    const [updated] = await db
      .update(recipes)
      .set({ notes: notes ?? null, updatedAt: new Date() })
      .where(eq(recipes.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    const product = (
      await db.select().from(products).where(eq(products.id, updated.productId))
    )[0];
    const ings = await fetchIngredients(id);
    res.json({
      id: updated.id,
      productId: updated.productId,
      productName: product?.name ?? "",
      notes: updated.notes,
      ingredientCount: ings.length,
      ingredients: ings,
    });
  }),
);

recipesRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await db.delete(recipes).where(eq(recipes.id, Number(req.params.id)));
    res.json({ ok: true });
  }),
);

recipesRouter.get(
  "/:id/ingredients",
  asyncHandler(async (req, res) => {
    res.json(await fetchIngredients(Number(req.params.id)));
  }),
);

recipesRouter.post(
  "/:id/ingredients",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const recipeId = Number(req.params.id);
    const { inventoryItemId, quantity } = req.body ?? {};
    if (!inventoryItemId || quantity === undefined)
      return res.status(400).json({ error: "inventoryItemId, quantity required" });
    const [created] = await db
      .insert(recipeIngredients)
      .values({
        recipeId,
        inventoryItemId: Number(inventoryItemId),
        quantity: String(quantity),
      })
      .returning();
    const inv = (
      await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, created.inventoryItemId))
    )[0];
    res.json({
      id: created.id,
      recipeId: created.recipeId,
      inventoryItemId: created.inventoryItemId,
      inventoryItemName: inv?.name ?? "",
      unit: inv?.unit ?? "",
      quantity: Number(created.quantity),
    });
  }),
);

recipesRouter.put(
  "/:id/ingredients",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const recipeId = Number(req.params.id);
    const ingredients: Array<{ inventoryItemId: number; quantity: number }> =
      req.body?.ingredients ?? [];
    await db.transaction(async (tx) => {
      await tx
        .delete(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, recipeId));
      if (ingredients.length > 0) {
        await tx.insert(recipeIngredients).values(
          ingredients.map((i) => ({
            recipeId,
            inventoryItemId: Number(i.inventoryItemId),
            quantity: String(i.quantity),
          })),
        );
      }
    });
    res.json(await fetchIngredients(recipeId));
  }),
);

recipesRouter.put(
  "/:id/ingredients/:ingredientId",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const ingredientId = Number(req.params.ingredientId);
    const { quantity } = req.body ?? {};
    if (quantity === undefined)
      return res.status(400).json({ error: "quantity required" });
    const [updated] = await db
      .update(recipeIngredients)
      .set({ quantity: String(quantity) })
      .where(eq(recipeIngredients.id, ingredientId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    const inv = (
      await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, updated.inventoryItemId))
    )[0];
    res.json({
      id: updated.id,
      recipeId: updated.recipeId,
      inventoryItemId: updated.inventoryItemId,
      inventoryItemName: inv?.name ?? "",
      unit: inv?.unit ?? "",
      quantity: Number(updated.quantity),
    });
  }),
);

recipesRouter.delete(
  "/:id/ingredients/:ingredientId",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await db
      .delete(recipeIngredients)
      .where(
        and(
          eq(recipeIngredients.id, Number(req.params.ingredientId)),
          eq(recipeIngredients.recipeId, Number(req.params.id)),
        ),
      );
    res.json({ ok: true });
  }),
);

export const inventoryRouter: IRouter = Router();
inventoryRouter.use(requireAuth);

const mapInventory = (i: typeof inventoryItems.$inferSelect) => ({
  id: i.id,
  name: i.name,
  unit: i.unit,
  currentQuantity: Number(i.currentQuantity),
  minimumStock: Number(i.minimumStock),
  cost: Number(i.cost),
  supplier: i.supplier,
  updatedAt: i.updatedAt.toISOString(),
});

inventoryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(inventoryItems)
      .orderBy(asc(inventoryItems.name));
    res.json(rows.map(mapInventory));
  }),
);
inventoryRouter.get(
  "/low-stock",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(inventoryItems)
      .where(lte(inventoryItems.currentQuantity, inventoryItems.minimumStock));
    res.json(rows.map(mapInventory));
  }),
);
inventoryRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { name, unit, currentQuantity, minimumStock, cost, supplier } =
      req.body ?? {};
    if (!name || !unit)
      return res.status(400).json({ error: "name, unit required" });
    const [created] = await db
      .insert(inventoryItems)
      .values({
        name: String(name),
        unit,
        currentQuantity: String(currentQuantity ?? 0),
        minimumStock: String(minimumStock ?? 0),
        cost: String(cost ?? 0),
        supplier: supplier ?? null,
      })
      .returning();
    res.json(mapInventory(created));
  }),
);
inventoryRouter.put(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { name, unit, currentQuantity, minimumStock, cost, supplier } =
      req.body ?? {};
    const updates: Partial<typeof inventoryItems.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updates.name = String(name);
    if (unit !== undefined) updates.unit = unit;
    if (currentQuantity !== undefined)
      updates.currentQuantity = String(currentQuantity);
    if (minimumStock !== undefined) updates.minimumStock = String(minimumStock);
    if (cost !== undefined) updates.cost = String(cost);
    if (supplier !== undefined) updates.supplier = supplier;
    const [updated] = await db
      .update(inventoryItems)
      .set(updates)
      .where(eq(inventoryItems.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(mapInventory(updated));
  }),
);
inventoryRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const force = req.query.force === "true" || req.body?.force === true;

    const result = await db.transaction(async (tx) => {
      // Lock the row so concurrent recipe edits cannot sneak ingredients
      // in between our usage check and the final delete.
      const locked = await tx.execute(
        sql`SELECT id FROM inventory_items WHERE id = ${id} FOR UPDATE`,
      );
      if (locked.rows.length === 0) return { status: 404 as const };

      const usage = await tx
        .select({
          recipeId: recipeIngredients.recipeId,
          productId: recipes.productId,
          productName: products.name,
        })
        .from(recipeIngredients)
        .leftJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
        .leftJoin(products, eq(products.id, recipes.productId))
        .where(eq(recipeIngredients.inventoryItemId, id));

      if (usage.length > 0 && !force) {
        return {
          status: 409 as const,
          usedIn: usage.map((u) => ({
            recipeId: u.recipeId,
            productId: u.productId,
            productName: u.productName ?? "",
          })),
        };
      }

      if (usage.length > 0) {
        await tx
          .delete(recipeIngredients)
          .where(eq(recipeIngredients.inventoryItemId, id));
      }
      await tx
        .delete(inventoryMovements)
        .where(eq(inventoryMovements.inventoryItemId, id));
      await tx.delete(inventoryItems).where(eq(inventoryItems.id, id));
      return { status: 200 as const };
    });

    if (result.status === 404)
      return res.status(404).json({ error: "Not found" });
    if (result.status === 409)
      return res.status(409).json({
        error: "Inventory item is used in recipes",
        usedIn: result.usedIn,
      });
    res.json({ ok: true });
  }),
);
inventoryRouter.post(
  "/:id/adjust",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const change = Number(req.body?.change);
    const reason = String(req.body?.reason ?? "manual adjustment");
    if (!change || Number.isNaN(change))
      return res.status(400).json({ error: "change required" });
    const updated = await db.transaction(async (tx) => {
      const cur = (
        await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, id))
      )[0];
      if (!cur) throw new Error("Not found");
      const newQty = Number(cur.currentQuantity) + change;
      const [u] = await tx
        .update(inventoryItems)
        .set({ currentQuantity: String(newQty), updatedAt: new Date() })
        .where(eq(inventoryItems.id, id))
        .returning();
      await tx.insert(inventoryMovements).values({
        inventoryItemId: id,
        change: String(change),
        reason,
        userId: req.auth!.userId,
      });
      return u;
    });
    res.json(mapInventory(updated));
  }),
);
