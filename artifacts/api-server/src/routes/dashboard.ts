import { Router, type IRouter } from "express";
import { eq, sql, and, gte } from "drizzle-orm";
import { db, ordersTable, productsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [todayStats] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(total), 0)`,
      orders: sql<number>`COUNT(*)`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, todayStart), eq(ordersTable.status, "completed")));

  const [yesterdayStats] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(total), 0)`,
      orders: sql<number>`COUNT(*)`,
    })
    .from(ordersTable)
    .where(and(
      eq(ordersTable.tenantId, tenantId),
      gte(ordersTable.createdAt, yesterdayStart),
      sql`${ordersTable.createdAt} < ${todayStart}`,
      eq(ordersTable.status, "completed")
    ));

  const [productCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(productsTable)
    .where(eq(productsTable.tenantId, tenantId));

  const [customerCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT cashier_id)` })
    .from(ordersTable)
    .where(eq(ordersTable.tenantId, tenantId));

  const todayRevenue = parseFloat(todayStats?.revenue ?? "0");
  const yesterdayRevenue = parseFloat(yesterdayStats?.revenue ?? "0");
  const todayOrders = Number(todayStats?.orders ?? 0);
  const yesterdayOrders = Number(yesterdayStats?.orders ?? 0);

  const revenueChange = yesterdayRevenue === 0 ? 0 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  const ordersChange = yesterdayOrders === 0 ? 0 : ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;

  res.json({
    todayRevenue,
    todayOrders,
    totalProducts: Number(productCount?.count ?? 0),
    totalCustomers: Number(customerCount?.count ?? 0),
    revenueChange: Math.round(revenueChange * 10) / 10,
    ordersChange: Math.round(ordersChange * 10) / 10,
  });
});

router.get("/dashboard/recent-orders", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.tenantId, tenantId))
    .orderBy(sql`created_at DESC`)
    .limit(10);

  res.json(orders.map(o => ({
    id: o.id,
    tenantId: o.tenantId,
    orderNumber: o.orderNumber,
    status: o.status,
    subtotal: parseFloat(o.subtotal as string),
    tax: parseFloat(o.tax as string),
    total: parseFloat(o.total as string),
    paymentMethod: o.paymentMethod ?? null,
    customerName: o.customerName ?? null,
    notes: o.notes ?? null,
    cashierId: o.cashierId ?? null,
    items: o.items as Array<{ productId: number; productName: string; quantity: number; unitPrice: number; subtotal: number }>,
    createdAt: o.createdAt.toISOString(),
  })));
});

router.get("/dashboard/sales-by-day", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`DATE(created_at)::text`,
      revenue: sql<string>`COALESCE(SUM(total), 0)`,
      orders: sql<number>`COUNT(*)`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, sevenDaysAgo)))
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at) ASC`);

  res.json(rows.map(r => ({
    date: r.date,
    revenue: parseFloat(r.revenue),
    orders: Number(r.orders),
  })));
});

router.get("/dashboard/top-products", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;

  const orders = await db
    .select({ items: ordersTable.items })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, tenantId), eq(ordersTable.status, "completed")));

  const productMap = new Map<number, { productId: number; productName: string; totalSold: number; totalRevenue: number }>();

  for (const order of orders) {
    const items = order.items as Array<{ productId: number; productName: string; quantity: number; unitPrice: number; subtotal: number }>;
    for (const item of items) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.totalSold += item.quantity;
        existing.totalRevenue += item.subtotal;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          totalSold: item.quantity,
          totalRevenue: item.subtotal,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  res.json(topProducts);
});

export default router;
