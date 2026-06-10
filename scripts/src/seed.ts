import bcrypt from "bcryptjs";
import {
  db,
  pool,
  users,
  areas,
  restaurantTables,
  categories,
  products,
  inventoryItems,
  recipes,
  recipeIngredients,
  roles,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

async function ensureUser(name: string, password: string, role: "ADMIN" | "WAITER" | "CASHIER") {
  const existing = (await db.select().from(users).where(eq(users.name, name)))[0];
  const passwordHash = await hash(password);
  if (existing) {
    await db.update(users).set({ passwordHash, role, active: true }).where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({ name, passwordHash, role });
  }
}

async function ensureArea(name: string): Promise<number> {
  const existing = (await db.select().from(areas).where(eq(areas.name, name)))[0];
  if (existing) return existing.id;
  const [created] = await db.insert(areas).values({ name }).returning();
  return created.id;
}

async function ensureTables(areaId: number, count: number) {
  const existing = await db.select().from(restaurantTables).where(eq(restaurantTables.areaId, areaId));
  const haveNumbers = new Set(existing.map((t) => t.number));
  const toInsert = [];
  for (let n = 1; n <= count; n++) {
    if (!haveNumbers.has(n)) toInsert.push({ areaId, number: n });
  }
  if (toInsert.length > 0) await db.insert(restaurantTables).values(toInsert);
}

async function ensureCategory(name: string, sortOrder: number): Promise<number> {
  const existing = (await db.select().from(categories).where(eq(categories.name, name)))[0];
  if (existing) return existing.id;
  const [c] = await db.insert(categories).values({ name, sortOrder }).returning();
  return c.id;
}

interface EnsureInventoryOpts {
  resetQuantity?: boolean;
}

async function ensureInventory(
  name: string,
  unit: "g" | "kg" | "ml" | "l" | "unit",
  qty: number,
  min: number,
  cost: number,
  supplier: string | undefined,
  opts: EnsureInventoryOpts,
): Promise<number> {
  const existing = (await db.select().from(inventoryItems).where(eq(inventoryItems.name, name)))[0];
  if (existing) {
    if (opts.resetQuantity) {
      await db
        .update(inventoryItems)
        .set({
          currentQuantity: String(qty),
          minimumStock: String(min),
          cost: String(cost),
          supplier: supplier ?? null,
          unit,
        })
        .where(eq(inventoryItems.id, existing.id));
    }
    return existing.id;
  }
  const [item] = await db
    .insert(inventoryItems)
    .values({
      name,
      unit,
      currentQuantity: String(qty),
      minimumStock: String(min),
      cost: String(cost),
      supplier: supplier ?? null,
    })
    .returning();
  return item.id;
}

async function ensureProduct(
  categoryId: number,
  name: string,
  price: number,
  description: string,
): Promise<number> {
  const existing = (await db.select().from(products).where(eq(products.name, name)))[0];
  if (existing) return existing.id;
  const [p] = await db
    .insert(products)
    .values({
      categoryId,
      name,
      description,
      price: String(price),
    })
    .returning();
  return p.id;
}

async function setRecipe(productId: number, ingredients: { invId: number; quantity: number }[]) {
  let recipe = (await db.select().from(recipes).where(eq(recipes.productId, productId)))[0];
  if (!recipe) {
    const [created] = await db.insert(recipes).values({ productId }).returning();
    recipe = created;
  }
  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipe.id));
  if (ingredients.length === 0) return;
  await db.insert(recipeIngredients).values(
    ingredients.map((i) => ({
      recipeId: recipe.id,
      inventoryItemId: i.invId,
      quantity: String(i.quantity),
    })),
  );
}

async function ensureRoles() {
  const existing = await db.select().from(roles);
  const have = new Set(existing.map((r) => r.name));
  const want: Array<{ name: "ADMIN" | "WAITER" | "CASHIER"; description: string }> = [
    { name: "ADMIN", description: "Full administrative access" },
    { name: "WAITER", description: "Take orders, manage tables" },
    { name: "CASHIER", description: "Process payments, log expenses" },
  ];
  const toInsert = want.filter((r) => !have.has(r.name));
  if (toInsert.length > 0) await db.insert(roles).values(toInsert);
}

export interface SeedOptions {
  resetQuantity?: boolean;
}

export async function runSeed(options: SeedOptions = {}) {
  const opts: EnsureInventoryOpts = { resetQuantity: !!options.resetQuantity };
  console.log("Seeding roles...");
  await ensureRoles();
  console.log("Seeding users...");
  await ensureUser("Sneider", "101001", "ADMIN");
  await ensureUser("Ana", "6041", "ADMIN");
  await ensureUser("Edwin", "1985", "ADMIN");
  await ensureUser("Merari", "9876", "WAITER");
  await ensureUser("Nahomy", "4565", "WAITER");
  await ensureUser("Donovan", "0001", "CASHIER");

  console.log("Seeding areas & tables...");
  const jardinId = await ensureArea("El Jardín");
  const salonId = await ensureArea("Salón");
  await ensureTables(jardinId, 30);
  await ensureTables(salonId, 30);

  console.log("Seeding categories...");
  const catCeviches = await ensureCategory("Ceviches", 1);
  const catBurgers = await ensureCategory("Hamburguesas", 2);
  const catMariscos = await ensureCategory("Mariscos", 3);
  const catBebidas = await ensureCategory("Bebidas", 4);
  const catEntradas = await ensureCategory("Entradas", 5);

  console.log("Seeding inventory...");
  const tomato = await ensureInventory("Tomate", "unit", 200, 30, 1.5, "Mercado Central", opts);
  const onion = await ensureInventory("Cebolla", "unit", 150, 20, 1.2, "Mercado Central", opts);
  const shrimp = await ensureInventory("Camarón", "g", 8000, 1500, 0.18, "Pescadería Don Carlos", opts);
  const concha = await ensureInventory("Concha", "g", 6000, 1000, 0.22, "Pescadería Don Carlos", opts);
  const lemon = await ensureInventory("Limón", "unit", 300, 50, 0.4, "Mercado Central", opts);
  const cilantro = await ensureInventory("Cilantro", "g", 2000, 300, 0.05, "Mercado Central", opts);
  const bun = await ensureInventory("Pan de hamburguesa", "unit", 120, 30, 3, "Panadería La Espiga", opts);
  const beef = await ensureInventory("Carne molida", "g", 12000, 2000, 0.12, "Carnicería El Toro", opts);
  const cheese = await ensureInventory("Queso americano", "unit", 200, 50, 1.8, "Distribuidora Lácteos", opts);
  const lettuce = await ensureInventory("Lechuga", "unit", 60, 15, 4, "Mercado Central", opts);
  const fish = await ensureInventory("Pescado fresco", "g", 10000, 2000, 0.2, "Pescadería Don Carlos", opts);
  const garlic = await ensureInventory("Ajo", "unit", 100, 20, 0.5, "Mercado Central", opts);
  const oil = await ensureInventory("Aceite", "ml", 5000, 1000, 0.01, "Distribuidora Sur", opts);
  const salt = await ensureInventory("Sal", "g", 5000, 500, 0.005, "Distribuidora Sur", opts);
  const beerBottle = await ensureInventory("Cerveza Gallo", "unit", 240, 48, 8, "Cervecería", opts);
  const cokeBottle = await ensureInventory("Coca-Cola 500ml", "unit", 120, 24, 6, "Distribuidora Bebidas", opts);
  const water = await ensureInventory("Agua mineral", "unit", 96, 24, 4, "Distribuidora Bebidas", opts);
  const potato = await ensureInventory("Papa", "g", 15000, 3000, 0.005, "Mercado Central", opts);
  const rice = await ensureInventory("Arroz", "g", 20000, 4000, 0.004, "Distribuidora Sur", opts);
  const blackBeans = await ensureInventory("Frijol negro", "g", 10000, 2000, 0.006, "Mercado Central", opts);
  const tortilla = await ensureInventory("Tortilla", "unit", 400, 100, 0.4, "Tortillería La Joya", opts);
  const avocado = await ensureInventory("Aguacate", "unit", 80, 20, 4, "Mercado Central", opts);
  const chicken = await ensureInventory("Pechuga de pollo", "g", 10000, 2000, 0.1, "Carnicería El Toro", opts);
  const octopus = await ensureInventory("Pulpo", "g", 4000, 800, 0.4, "Pescadería Don Carlos", opts);
  const flan = await ensureInventory("Flan casero", "unit", 30, 8, 8, "Cocina interna", opts);
  const tresLeches = await ensureInventory("Pastel tres leches", "unit", 24, 6, 12, "Cocina interna", opts);
  const horchataMix = await ensureInventory("Mezcla horchata", "g", 5000, 1000, 0.02, "Distribuidora Sur", opts);
  const limonada = await ensureInventory("Concentrado limonada", "ml", 4000, 800, 0.01, "Distribuidora Bebidas", opts);
  const milk = await ensureInventory("Leche", "ml", 6000, 1500, 0.005, "Distribuidora Lácteos", opts);

  console.log("Seeding products & recipes...");
  const ceviche = await ensureProduct(catCeviches, "Ceviche de Concho", 95, "Ceviche fresco de concha y camarón con limón");
  await setRecipe(ceviche, [
    { invId: tomato, quantity: 2 },
    { invId: onion, quantity: 0.5 },
    { invId: shrimp, quantity: 50 },
    { invId: concha, quantity: 50 },
    { invId: lemon, quantity: 3 },
    { invId: cilantro, quantity: 10 },
    { invId: salt, quantity: 5 },
  ]);

  const cevicheMixto = await ensureProduct(catCeviches, "Ceviche Mixto", 110, "Mezcla de pescado, camarón y concha");
  await setRecipe(cevicheMixto, [
    { invId: fish, quantity: 60 },
    { invId: shrimp, quantity: 40 },
    { invId: concha, quantity: 40 },
    { invId: tomato, quantity: 2 },
    { invId: onion, quantity: 0.5 },
    { invId: lemon, quantity: 3 },
    { invId: cilantro, quantity: 10 },
  ]);

  const burger = await ensureProduct(catBurgers, "Cheeseburger Don Concho", 75, "Hamburguesa con queso, lechuga y tomate");
  await setRecipe(burger, [
    { invId: bun, quantity: 1 },
    { invId: beef, quantity: 150 },
    { invId: cheese, quantity: 1 },
    { invId: tomato, quantity: 2 },
    { invId: lettuce, quantity: 0.25 },
    { invId: oil, quantity: 5 },
  ]);

  const doubleBurger = await ensureProduct(catBurgers, "Doble Carne", 95, "Doble hamburguesa con doble queso");
  await setRecipe(doubleBurger, [
    { invId: bun, quantity: 1 },
    { invId: beef, quantity: 280 },
    { invId: cheese, quantity: 2 },
    { invId: tomato, quantity: 2 },
    { invId: lettuce, quantity: 0.25 },
  ]);

  const camaronesAlAjillo = await ensureProduct(catMariscos, "Camarones al Ajillo", 130, "Camarones salteados en ajo y aceite");
  await setRecipe(camaronesAlAjillo, [
    { invId: shrimp, quantity: 200 },
    { invId: garlic, quantity: 4 },
    { invId: oil, quantity: 30 },
    { invId: salt, quantity: 5 },
    { invId: cilantro, quantity: 5 },
  ]);

  const pescadoFrito = await ensureProduct(catMariscos, "Pescado Frito", 120, "Filete de pescado frito con papas");
  await setRecipe(pescadoFrito, [
    { invId: fish, quantity: 250 },
    { invId: oil, quantity: 50 },
    { invId: salt, quantity: 5 },
    { invId: potato, quantity: 200 },
  ]);

  const papasFritas = await ensureProduct(catEntradas, "Papas Fritas", 30, "Porción de papas fritas crujientes");
  await setRecipe(papasFritas, [
    { invId: potato, quantity: 250 },
    { invId: oil, quantity: 30 },
    { invId: salt, quantity: 3 },
  ]);

  const cerveza = await ensureProduct(catBebidas, "Cerveza Gallo", 18, "Cerveza Gallo botella 330ml");
  await setRecipe(cerveza, [{ invId: beerBottle, quantity: 1 }]);

  const coca = await ensureProduct(catBebidas, "Coca-Cola", 15, "Botella 500ml");
  await setRecipe(coca, [{ invId: cokeBottle, quantity: 1 }]);

  const agua = await ensureProduct(catBebidas, "Agua mineral", 10, "Botella 500ml");
  await setRecipe(agua, [{ invId: water, quantity: 1 }]);

  const cevichePulpo = await ensureProduct(catCeviches, "Ceviche de Pulpo", 125, "Pulpo tierno con limón, cebolla morada y cilantro");
  await setRecipe(cevichePulpo, [
    { invId: octopus, quantity: 120 },
    { invId: tomato, quantity: 2 },
    { invId: onion, quantity: 0.5 },
    { invId: lemon, quantity: 3 },
    { invId: cilantro, quantity: 10 },
    { invId: salt, quantity: 5 },
  ]);

  const polloPlancha = await ensureProduct(catMariscos, "Pollo a la Plancha", 90, "Pechuga de pollo a la plancha con arroz y frijoles");
  await setRecipe(polloPlancha, [
    { invId: chicken, quantity: 220 },
    { invId: rice, quantity: 150 },
    { invId: blackBeans, quantity: 100 },
    { invId: oil, quantity: 10 },
    { invId: salt, quantity: 5 },
  ]);

  const chickenBurger = await ensureProduct(catBurgers, "Chicken Burger", 70, "Hamburguesa de pollo a la parrilla");
  await setRecipe(chickenBurger, [
    { invId: bun, quantity: 1 },
    { invId: chicken, quantity: 180 },
    { invId: lettuce, quantity: 0.25 },
    { invId: tomato, quantity: 2 },
    { invId: oil, quantity: 5 },
  ]);

  const guacamole = await ensureProduct(catEntradas, "Guacamole con Tortillas", 45, "Guacamole fresco con tortillas crujientes");
  await setRecipe(guacamole, [
    { invId: avocado, quantity: 2 },
    { invId: tomato, quantity: 1 },
    { invId: onion, quantity: 0.25 },
    { invId: lemon, quantity: 1 },
    { invId: cilantro, quantity: 5 },
    { invId: tortilla, quantity: 6 },
    { invId: salt, quantity: 2 },
  ]);

  const cocteles = await ensureProduct(catEntradas, "Coctel de Camarón", 85, "Camarones en salsa de coctel con aguacate");
  await setRecipe(cocteles, [
    { invId: shrimp, quantity: 150 },
    { invId: avocado, quantity: 1 },
    { invId: tomato, quantity: 2 },
    { invId: onion, quantity: 0.25 },
    { invId: lemon, quantity: 2 },
    { invId: cilantro, quantity: 5 },
  ]);

  const sopaMariscos = await ensureProduct(catMariscos, "Sopa de Mariscos", 115, "Sopa caliente con camarón, pescado y concha");
  await setRecipe(sopaMariscos, [
    { invId: shrimp, quantity: 80 },
    { invId: fish, quantity: 80 },
    { invId: concha, quantity: 50 },
    { invId: tomato, quantity: 2 },
    { invId: onion, quantity: 0.5 },
    { invId: garlic, quantity: 2 },
    { invId: cilantro, quantity: 5 },
    { invId: salt, quantity: 5 },
  ]);

  const arrozFrijoles = await ensureProduct(catEntradas, "Arroz con Frijoles", 25, "Acompañamiento de arroz blanco y frijoles negros");
  await setRecipe(arrozFrijoles, [
    { invId: rice, quantity: 150 },
    { invId: blackBeans, quantity: 100 },
    { invId: salt, quantity: 2 },
  ]);

  const flanProduct = await ensureProduct(catEntradas, "Flan de la Casa", 35, "Flan casero de leche con caramelo");
  await setRecipe(flanProduct, [{ invId: flan, quantity: 1 }]);

  const tresLechesProduct = await ensureProduct(catEntradas, "Tres Leches", 40, "Pastel tres leches tradicional");
  await setRecipe(tresLechesProduct, [{ invId: tresLeches, quantity: 1 }]);

  const horchata = await ensureProduct(catBebidas, "Horchata", 18, "Bebida fría de horchata con leche");
  await setRecipe(horchata, [
    { invId: horchataMix, quantity: 30 },
    { invId: milk, quantity: 250 },
  ]);

  const limonadaProduct = await ensureProduct(catBebidas, "Limonada Natural", 16, "Limonada fresca con limón natural");
  await setRecipe(limonadaProduct, [
    { invId: limonada, quantity: 40 },
    { invId: lemon, quantity: 2 },
  ]);

  console.log("Seed complete");
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const resetQuantity = process.argv.includes("--reset-quantity");
  runSeed({ resetQuantity })
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
