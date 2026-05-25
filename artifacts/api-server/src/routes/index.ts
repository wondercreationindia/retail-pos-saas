import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tenantsRouter from "./tenants";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import ordersRouter from "./orders";
import dashboardRouter from "./dashboard";
import suppliersRouter from "./suppliers";
import inventoryRouter from "./inventory";
import purchasesRouter from "./purchases";
import customersRouter from "./customers";
import posRouter from "./pos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tenantsRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(dashboardRouter);
router.use(suppliersRouter);
router.use(inventoryRouter);
router.use(purchasesRouter);
router.use(customersRouter);
router.use(posRouter);

export default router;
