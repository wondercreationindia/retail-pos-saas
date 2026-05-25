import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { db, salesTable, saleItemsTable, paymentsTable, heldBillsTable, productsTable, customersTable } from "@workspace/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

const router = Router();

function numStr(v: unknown) {
  return v !== null && v !== undefined ? parseFloat(String(v)) : 0;
}

function formatSale(sale: typeof salesTable.$inferSelect, items: typeof saleItemsTable.$inferSelect[], payments: typeof paymentsTable.$inferSelect[]) {
  return {
    ...sale,
    subtotal: numStr(sale.subtotal),
    discountAmount: numStr(sale.discountAmount),
    taxAmount: numStr(sale.taxAmount),
    total: numStr(sale.total),
    paidAmount: numStr(sale.paidAmount),
    changeAmount: numStr(sale.changeAmount),
    items: items.map((i) => ({
      ...i,
      quantity: numStr(i.quantity),
      unitPrice: numStr(i.unitPrice),
      mrp: i.mrp ? numStr(i.mrp) : null,
      discountPct: numStr(i.discountPct),
      discountAmount: numStr(i.discountAmount),
      gstRate: numStr(i.gstRate),
      gstAmount: numStr(i.gstAmount),
      subtotal: numStr(i.subtotal),
      total: numStr(i.total),
    })),
    payments: payments.map((p) => ({
      ...p,
      amount: numStr(p.amount),
    })),
  };
}

// Generate sale number
async function nextSaleNumber(tenantId: number): Promise<string> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(salesTable)
    .where(eq(salesTable.tenantId, tenantId));
  const num = (Number(row?.count ?? 0) + 1).toString().padStart(6, "0");
  return `SALE-${num}`;
}

// ─── LIST SALES ──────────────────────────────────────────────────────────────
router.get("/pos/sales", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { limit = "50", offset = "0", customerId, dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [eq(salesTable.tenantId, tenantId)];
  if (customerId) conditions.push(eq(salesTable.customerId, parseInt(customerId)));
  if (dateFrom) conditions.push(gte(salesTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(salesTable.createdAt, new Date(dateTo + "T23:59:59")));

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(...conditions))
    .orderBy(desc(salesTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  // Fetch items and payments for each sale
  const saleIds = sales.map((s) => s.id);
  if (saleIds.length === 0) return res.json([]);

  const [allItems, allPayments] = await Promise.all([
    db.select().from(saleItemsTable).where(and(eq(saleItemsTable.tenantId, tenantId))),
    db.select().from(paymentsTable).where(and(eq(paymentsTable.tenantId, tenantId))),
  ]);

  const itemsMap = new Map<number, typeof saleItemsTable.$inferSelect[]>();
  const paymentsMap = new Map<number, typeof paymentsTable.$inferSelect[]>();
  for (const item of allItems) {
    if (!itemsMap.has(item.saleId)) itemsMap.set(item.saleId, []);
    itemsMap.get(item.saleId)!.push(item);
  }
  for (const p of allPayments) {
    if (!paymentsMap.has(p.saleId)) paymentsMap.set(p.saleId, []);
    paymentsMap.get(p.saleId)!.push(p);
  }

  res.json(sales.map((s) => formatSale(s, itemsMap.get(s.id) ?? [], paymentsMap.get(s.id) ?? [])));
});

// ─── GET SALE ────────────────────────────────────────────────────────────────
router.get("/pos/sales/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(req.params.id);

  const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tenantId)));
  if (!sale) return res.status(404).json({ error: "Sale not found" });

  const [items, payments] = await Promise.all([
    db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id)),
    db.select().from(paymentsTable).where(eq(paymentsTable.saleId, id)),
  ]);

  res.json(formatSale(sale, items, payments));
});

// ─── CREATE SALE ─────────────────────────────────────────────────────────────
router.post("/pos/sales", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const cashierId = req.user!.userId;
  const { customerId, customerName, items, payments, subtotal, discountAmount = 0, taxAmount = 0, total, paidAmount, changeAmount = 0, loyaltyPointsRedeemed = 0, notes } = req.body;

  const saleNumber = await nextSaleNumber(tenantId);

  // Calculate loyalty points earned (1 point per 100 rupees)
  const loyaltyPointsEarned = Math.floor(total / 100);

  const [sale] = await db
    .insert(salesTable)
    .values({
      tenantId,
      saleNumber,
      customerId: customerId ?? null,
      customerName: customerName ?? null,
      cashierId,
      status: "completed",
      subtotal: subtotal.toString(),
      discountAmount: discountAmount.toString(),
      taxAmount: taxAmount.toString(),
      total: total.toString(),
      paidAmount: paidAmount.toString(),
      changeAmount: changeAmount.toString(),
      paymentStatus: "paid",
      loyaltyPointsEarned,
      loyaltyPointsRedeemed,
      notes: notes ?? null,
    })
    .returning();

  // Insert sale items
  const insertedItems = items && items.length > 0
    ? await db
        .insert(saleItemsTable)
        .values(
          items.map((item: Record<string, unknown>) => ({
            tenantId,
            saleId: sale.id,
            productId: item.productId ?? null,
            productName: String(item.productName),
            sku: item.sku ?? null,
            barcode: item.barcode ?? null,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            mrp: item.mrp ? String(item.mrp) : null,
            discountPct: String(item.discountPct ?? 0),
            discountAmount: String(item.discountAmount ?? 0),
            gstRate: String(item.gstRate ?? 0),
            gstAmount: String(item.gstAmount ?? 0),
            subtotal: String(item.subtotal),
            total: String(item.total),
          }))
        )
        .returning()
    : [];

  // Insert payments
  const insertedPayments = payments && payments.length > 0
    ? await db
        .insert(paymentsTable)
        .values(
          payments.map((p: Record<string, unknown>) => ({
            tenantId,
            saleId: sale.id,
            method: String(p.method),
            amount: String(p.amount),
            reference: p.reference ? String(p.reference) : null,
          }))
        )
        .returning()
    : [];

  // Deduct stock for each product
  for (const item of items ?? []) {
    if (item.productId) {
      await db
        .update(productsTable)
        .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${Number(item.quantity)}`, updatedAt: new Date() })
        .where(and(eq(productsTable.id, item.productId as number), eq(productsTable.tenantId, tenantId)));
    }
  }

  // Update customer loyalty points and total purchases
  if (customerId) {
    await db
      .update(customersTable)
      .set({
        loyaltyPoints: sql`${customersTable.loyaltyPoints} + ${loyaltyPointsEarned} - ${loyaltyPointsRedeemed}`,
        totalPurchases: sql`${customersTable.totalPurchases} + ${total}`,
        updatedAt: new Date(),
      })
      .where(and(eq(customersTable.id, customerId), eq(customersTable.tenantId, tenantId)));
  }

  res.status(201).json(formatSale(sale, insertedItems, insertedPayments));
});

// ─── HELD BILLS ──────────────────────────────────────────────────────────────
router.get("/pos/held-bills", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const bills = await db.select().from(heldBillsTable).where(eq(heldBillsTable.tenantId, tenantId)).orderBy(desc(heldBillsTable.createdAt));
  res.json(bills);
});

router.post("/pos/held-bills", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const cashierId = req.user!.userId;
  const { label, cartData } = req.body;

  const [bill] = await db
    .insert(heldBillsTable)
    .values({ tenantId, cashierId, label: label ?? null, cartData })
    .returning();

  res.status(201).json(bill);
});

router.delete("/pos/held-bills/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(req.params.id);

  await db.delete(heldBillsTable).where(and(eq(heldBillsTable.id, id), eq(heldBillsTable.tenantId, tenantId)));
  res.status(204).end();
});

export default router;
