import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  date,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["ADMIN", "WAITER", "CASHIER"]);
export const tableStatusEnum = pgEnum("table_status", [
  "free",
  "occupied",
  "waiting_payment",
  "closed",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "open",
  "sent",
  "paid",
  "void",
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "pending",
  "preparing",
  "ready",
  "delivered",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "transfer",
]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "food_supplies",
  "drinks",
  "utilities",
  "payroll",
  "maintenance",
  "transport",
  "miscellaneous",
]);
export const inventoryUnitEnum = pgEnum("inventory_unit", [
  "g",
  "kg",
  "ml",
  "l",
  "unit",
]);

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    name: roleEnum("name").notNull(),
    description: text("description"),
  },
  (t) => [uniqueIndex("roles_name_unique").on(t.name)],
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_name_unique").on(t.name)],
);

export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
});

export const restaurantTables = pgTable(
  "restaurant_tables",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id),
    number: integer("number").notNull(),
    status: tableStatusEnum("status").notNull().default("free"),
    openedAt: timestamp("opened_at"),
    openedByUserId: integer("opened_by_user_id").references(() => users.id),
  },
  (t) => [
    uniqueIndex("table_area_number_unique").on(t.areaId, t.number),
    index("table_status_idx").on(t.status),
  ],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("image_url"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("products_category_idx").on(t.categoryId)],
);

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  unit: inventoryUnitEnum("unit").notNull(),
  currentQuantity: numeric("current_quantity", { precision: 12, scale: 3 })
    .notNull()
    .default("0"),
  minimumStock: numeric("minimum_stock", { precision: 12, scale: 3 })
    .notNull()
    .default("0"),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull().default("0"),
  supplier: varchar("supplier", { length: 120 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recipes_product_unique").on(t.productId)],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    inventoryItemId: integer("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  change: numeric("change", { precision: 12, scale: 3 }).notNull(),
  reason: varchar("reason", { length: 200 }).notNull(),
  saleId: integer("sale_id"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    tableId: integer("table_id")
      .notNull()
      .references(() => restaurantTables.id),
    waiterId: integer("waiter_id")
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_table_idx").on(t.tableId),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kitchenTickets = pgTable("kitchen_tickets", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: ticketStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    tableId: integer("table_id")
      .notNull()
      .references(() => restaurantTables.id),
    waiterId: integer("waiter_id").references(() => users.id),
    cashierId: integer("cashier_id")
      .notNull()
      .references(() => users.id),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sales_created_idx").on(t.createdAt)],
);

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  productName: varchar("product_name", { length: 120 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  method: paymentMethodEnum("method").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: expenseCategoryEnum("category").notNull(),
    supplier: varchar("supplier", { length: 160 }),
    expenseDate: date("expense_date").notNull(),
    invoiceNumber: varchar("invoice_number", { length: 80 }),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    createdById: integer("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("expenses_date_idx").on(t.expenseDate)],
);

export const dailyCloses = pgTable(
  "daily_closes",
  {
    id: serial("id").primaryKey(),
    closeDate: date("close_date").notNull(),
    totalSales: numeric("total_sales", { precision: 12, scale: 2 }).notNull(),
    totalExpenses: numeric("total_expenses", { precision: 12, scale: 2 })
      .notNull(),
    netProfit: numeric("net_profit", { precision: 12, scale: 2 }).notNull(),
    transactionCount: integer("transaction_count").notNull(),
    finalized: boolean("finalized").notNull().default(false),
    payload: jsonb("payload").notNull(),
    createdById: integer("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_close_date_unique").on(t.closeDate)],
);

export const fixedCostCategoryEnum = pgEnum("fixed_cost_category", [
  "luz",
  "agua",
  "internet",
  "local",
  "basura",
  "personal",
  "otro",
]);

export const fixedCosts = pgTable("fixed_costs", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: fixedCostCategoryEnum("category").notNull(),
  monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const inventoryPurchases = pgTable("inventory_purchases", {
  id: serial("id").primaryKey(),
  supplier: varchar("supplier", { length: 160 }),
  purchaseDate: date("purchase_date").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryPurchaseItems = pgTable("inventory_purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => inventoryPurchases.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id").notNull().references(() => inventoryItems.id),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull(),
});
