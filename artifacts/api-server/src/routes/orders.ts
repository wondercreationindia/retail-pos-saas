import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ordersTable, productsTable } from "@workspace/db";
import {
  CreateOrderBody,
  UpdateOrderBody,
  GetOrderParams,
  UpdateOrderParams,
  ListOrdersQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function formatOrder(o: typeof ordersTable.$inferSelect) {
  return {
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
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const queryParams = ListOrdersQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { status, limit } = queryParams.data;
  let query = db.select().from(ordersTable).where(eq(ordersTable.tenantId, req.user!.tenantId)).$dynamic();

  if (status) {
    query = query.where(and(eq(ordersTable.tenantId, req.user!.tenantId), eq(ordersTable.status, status)));
  }
  if (limit) {
    query = query.limit(limit);
  }

  const orders = await query;
  res.json(orders.map(formatOrder));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, paymentMethod, customerName, notes, tax } = parsed.data;
  const orderItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; subtotal: number }> = [];
  let subtotal = 0;

  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(
      and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, req.user!.tenantId))
    );
    if (!product) {
      res.status(400).json({ error: `Product ${item.productId} not found` });
      return;
    }
    const unitPrice = parseFloat(product.price as string);
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
      subtotal: itemSubtotal,
    });
  }

  const taxAmount = tax ?? 0;
  const total = subtotal + taxAmount;
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

  const [order] = await db.insert(ordersTable).values({
    tenantId: req.user!.tenantId,
    orderNumber,
    status: "pending",
    subtotal: String(subtotal),
    tax: String(taxAmount),
    total: String(total),
    paymentMethod: paymentMethod ?? null,
    customerName: customerName ?? null,
    notes: notes ?? null,
    cashierId: req.user!.userId,
    items: orderItems,
  }).returning();

  res.status(201).json(formatOrder(order!));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, params.data.id), eq(ordersTable.tenantId, req.user!.tenantId))
  );

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(formatOrder(order));
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .update(ordersTable)
    .set(parsed.data)
    .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(formatOrder(order));
});

export default router;
