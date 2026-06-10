import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { runSeed } from "./seed";

async function resetTransactionalData() {
  console.log("Truncating transactional tables...");
  await db.execute(sql`
    TRUNCATE TABLE
      payments,
      sale_items,
      sales,
      kitchen_tickets,
      order_items,
      orders,
      expenses,
      daily_closes,
      inventory_movements
    RESTART IDENTITY CASCADE
  `);

  console.log("Resetting table statuses to free...");
  await db.execute(sql`
    UPDATE restaurant_tables
       SET status = 'free',
           opened_at = NULL,
           opened_by_user_id = NULL
  `);
}

async function main() {
  await resetTransactionalData();
  console.log("Re-seeding baseline data (with inventory quantity reset)...");
  await runSeed({ resetQuantity: true });
  console.log("Demo data reset complete");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
