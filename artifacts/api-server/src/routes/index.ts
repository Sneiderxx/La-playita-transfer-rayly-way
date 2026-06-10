import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import tablesRouter from "./tables";
import { categoriesRouter, productsRouter, recipesRouter, inventoryRouter } from "./catalog";
import ordersRouter from "./orders";
import kitchenRouter from "./kitchen";
import salesRouter from "./sales";
import expensesRouter from "./expenses";
import analyticsRouter from "./analytics";
import dailyCloseRouter from "./dailyClose";
import fixedCostsRouter from "./fixedCosts";
import inventoryPurchasesRouter from "./inventoryPurchases";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/tables", tablesRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/recipes", recipesRouter);
router.use("/inventory", inventoryRouter);
router.use("/orders", ordersRouter);
router.use("/kitchen", kitchenRouter);
router.use("/sales", salesRouter);
router.use("/expenses", expensesRouter);
router.use("/analytics", analyticsRouter);
router.use("/daily-close", dailyCloseRouter);
router.use("/fixed-costs", fixedCostsRouter);
router.use("/inventory-purchases", inventoryPurchasesRouter);

router.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  const message = err.message ?? "Error interno del servidor";
  res.status(status).json({ error: message });
});

export default router;
