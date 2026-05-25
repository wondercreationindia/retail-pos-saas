import { Router } from "express";
import { requireAuth } from "../lib/auth";
import {
  db,
  salesTable,
  saleItemsTable,
  paymentsTable,
  heldBillsTable,
  productsTable,
  customersTable,
  couponsTable,
  loyaltyTransactionsTable,
  invoiceEditsTable,
  invoicePrintLogsTable,
  whatsappInvoiceLogsTable,
  cashierSessionsTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

const qs = (v: unknown, def = ""): string =>
  typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? (v[0] ?? def) : def;

const router = Router();

function numStr(v: unknown) {
  return v !== null && v !== undefined ? parseFloat(String(v)) : 0;
}

function formatSale(
  sale: typeof salesTable.$inferSelect,
  items: typeof saleItemsTable.$inferSelect[],
  payments: typeof paymentsTable.$inferSelect[]
) {
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

async function nextSaleNumber(tenantId: number): Promise<string> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(salesTable)
    .where(eq(salesTable.tenantId, tenantId));
  const num = (Number(row?.count ?? 0) + 1).toString().padStart(6, "0");
  return `SALE-${num}`;
}

// ─── LIST SALES ───────────────────────────────────────────────────────────────
router.get("/pos/sales", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const limit = qs(req.query.limit, "50");
  const offset = qs(req.query.offset, "0");
  const customerId = qs(req.query.customerId);
  const dateFrom = qs(req.query.dateFrom);
  const dateTo = qs(req.query.dateTo);
  const search = qs(req.query.search);
  const status = qs(req.query.status);

  const conditions: ReturnType<typeof eq>[] = [eq(salesTable.tenantId, tenantId)];
  if (customerId) conditions.push(eq(salesTable.customerId, parseInt(customerId)));
  if (dateFrom) conditions.push(gte(salesTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(salesTable.createdAt, new Date(dateTo + "T23:59:59")));
  if (status) conditions.push(eq(salesTable.status, status));

  const sales = await db
    .select()
    .from(salesTable)
    .where(and(...conditions))
    .orderBy(desc(salesTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  let filtered = sales;
  if (search) {
    const q = search.toLowerCase();
    filtered = sales.filter(
      (s) =>
        s.saleNumber.toLowerCase().includes(q) ||
        (s.customerName ?? "").toLowerCase().includes(q)
    );
  }

  const saleIds = filtered.map((s) => s.id);
  if (saleIds.length === 0) return res.json([]);

  const [allItems, allPayments] = await Promise.all([
    db.select().from(saleItemsTable).where(eq(saleItemsTable.tenantId, tenantId)),
    db.select().from(paymentsTable).where(eq(paymentsTable.tenantId, tenantId)),
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

  return res.json(
    filtered.map((s) =>
      formatSale(s, itemsMap.get(s.id) ?? [], paymentsMap.get(s.id) ?? [])
    )
  );
});

// ─── GET SALE ─────────────────────────────────────────────────────────────────
router.get("/pos/sales/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(qs(req.params.id));

  const [sale] = await db
    .select()
    .from(salesTable)
    .where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tenantId)));
  if (!sale) return res.status(404).json({ error: "Sale not found" });

  const [items, payments] = await Promise.all([
    db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id)),
    db.select().from(paymentsTable).where(eq(paymentsTable.saleId, id)),
  ]);

  return res.json(formatSale(sale, items, payments));
});

// ─── EDIT SALE ────────────────────────────────────────────────────────────────
router.patch("/pos/sales/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const id = parseInt(qs(req.params.id));
  const { items, payments, discountAmount, notes, reason, customerId, customerName } = req.body as {
    items?: Record<string, unknown>[];
    payments?: Record<string, unknown>[];
    discountAmount?: number;
    notes?: string;
    reason?: string;
    customerId?: number | null;
    customerName?: string | null;
  };

  const [sale] = await db
    .select()
    .from(salesTable)
    .where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tenantId)));
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  if (sale.status === "voided") return res.status(400).json({ error: "Cannot edit a voided sale" });

  const [oldItems, oldPayments] = await Promise.all([
    db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id)),
    db.select().from(paymentsTable).where(eq(paymentsTable.saleId, id)),
  ]);

  const beforeSnapshot = formatSale(sale, oldItems, oldPayments);

  // Restore stock for old items
  for (const item of oldItems) {
    if (item.productId) {
      await db
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${numStr(item.quantity)}`, updatedAt: new Date() })
        .where(and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId)));
    }
  }

  // Delete old items and payments
  await db.delete(saleItemsTable).where(eq(saleItemsTable.saleId, id));
  await db.delete(paymentsTable).where(eq(paymentsTable.saleId, id));

  // Recalculate totals
  type AnyItem = Record<string, unknown>;
  const newItems: AnyItem[] = items ?? oldItems.map((i) => ({ ...i, quantity: numStr(i.quantity), unitPrice: numStr(i.unitPrice), subtotal: numStr(i.subtotal), total: numStr(i.total) }));
  const subtotal = newItems.reduce((s: number, i: AnyItem) => s + numStr(i.subtotal ?? i.total), 0);
  const newDiscount = discountAmount ?? numStr(sale.discountAmount);
  const taxAmount = newItems.reduce((s: number, i: AnyItem) => s + numStr(i.gstAmount), 0);
  const total = Math.max(0, subtotal - newDiscount + taxAmount);
  const paidAmount = (payments ?? []).reduce((s: number, p: Record<string, unknown>) => s + numStr(p.amount), 0) || total;

  // Update sale
  const [updatedSale] = await db
    .update(salesTable)
    .set({
      discountAmount: newDiscount.toString(),
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      total: total.toString(),
      paidAmount: paidAmount.toString(),
      changeAmount: Math.max(0, paidAmount - total).toString(),
      notes: notes ?? sale.notes,
      customerId: customerId !== undefined ? customerId : sale.customerId,
      customerName: customerName !== undefined ? customerName : sale.customerName,
      updatedAt: new Date(),
    })
    .where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tenantId)))
    .returning();

  // Re-insert items
  const insertedItems =
    newItems.length > 0
      ? await db
          .insert(saleItemsTable)
          .values(
            newItems.map((item: Record<string, unknown>) => ({
              tenantId,
              saleId: id,
              productId: (item.productId as number) ?? null,
              productName: String(item.productName),
              sku: item.sku ? String(item.sku) : null,
              barcode: item.barcode ? String(item.barcode) : null,
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

  // Re-insert payments
  const newPayments = payments ?? [{ method: "cash", amount: paidAmount }];
  const insertedPayments = await db
    .insert(paymentsTable)
    .values(
      newPayments.map((p: Record<string, unknown>) => ({
        tenantId,
        saleId: id,
        method: String(p.method),
        amount: String(p.amount),
        reference: p.reference ? String(p.reference) : null,
      }))
    )
    .returning();

  // Deduct stock for new items
  for (const item of newItems) {
    if ((item as Record<string, unknown>).productId) {
      await db
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${numStr((item as Record<string, unknown>).quantity)}`, updatedAt: new Date() })
        .where(and(eq(productsTable.id, (item as Record<string, unknown>).productId as number), eq(productsTable.tenantId, tenantId)));
    }
  }

  // Write audit log
  await db.insert(invoiceEditsTable).values({
    tenantId,
    saleId: id,
    editedBy: userId,
    reason: reason ?? "Manual edit",
    beforeSnapshot,
    afterSnapshot: formatSale(updatedSale!, insertedItems, insertedPayments),
  });

  return res.json(formatSale(updatedSale!, insertedItems, insertedPayments));
});

// ─── VOID SALE ────────────────────────────────────────────────────────────────
router.post("/pos/sales/:id/void", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const id = parseInt(qs(req.params.id));
  const { reason } = req.body as { reason: string };

  if (!reason) return res.status(400).json({ error: "Reason is required" });

  const [sale] = await db
    .select()
    .from(salesTable)
    .where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tenantId)));
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  if (sale.status === "voided") return res.status(400).json({ error: "Sale is already voided" });

  const oldItems = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id));
  const oldPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.saleId, id));
  const beforeSnapshot = formatSale(sale, oldItems, oldPayments);

  // Restore stock
  for (const item of oldItems) {
    if (item.productId) {
      await db
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${numStr(item.quantity)}`, updatedAt: new Date() })
        .where(and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId)));
    }
  }

  // Reverse loyalty points
  if (sale.customerId && (sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0)) {
    await db
      .update(customersTable)
      .set({
        loyaltyPoints: sql`${customersTable.loyaltyPoints} - ${sale.loyaltyPointsEarned} + ${sale.loyaltyPointsRedeemed}`,
        totalPurchases: sql`${customersTable.totalPurchases} - ${numStr(sale.total)}`,
        updatedAt: new Date(),
      })
      .where(and(eq(customersTable.id, sale.customerId), eq(customersTable.tenantId, tenantId)));
  }

  const [updatedSale] = await db
    .update(salesTable)
    .set({ status: "voided", paymentStatus: "voided", updatedAt: new Date() })
    .where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tenantId)))
    .returning();

  // Audit log for void
  await db.insert(invoiceEditsTable).values({
    tenantId,
    saleId: id,
    editedBy: userId,
    reason: `VOID: ${reason}`,
    beforeSnapshot,
    afterSnapshot: { ...beforeSnapshot, status: "voided" },
  });

  return res.json(formatSale(updatedSale!, oldItems, oldPayments));
});

// ─── LOG PRINT ─────────────────────────────────────────────────────────────────
router.post("/pos/sales/:id/print", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const id = parseInt(qs(req.params.id));
  const { printType = "thermal", isDuplicate = false } = req.body as { printType?: string; isDuplicate?: boolean };

  const [log] = await db
    .insert(invoicePrintLogsTable)
    .values({ tenantId, saleId: id, printedBy: userId, printType, isDuplicate: isDuplicate ? 1 : 0 })
    .returning();

  return res.status(201).json(log);
});

// ─── LOG WHATSAPP ──────────────────────────────────────────────────────────────
router.post("/pos/sales/:id/whatsapp", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.userId;
  const id = parseInt(qs(req.params.id));
  const { phone } = req.body as { phone: string };

  if (!phone) return res.status(400).json({ error: "Phone is required" });

  const [log] = await db
    .insert(whatsappInvoiceLogsTable)
    .values({ tenantId, saleId: id, sentBy: userId, phone, status: "sent" })
    .returning();

  return res.status(201).json(log);
});

// ─── GET SALE EDITS ────────────────────────────────────────────────────────────
router.get("/pos/sales/:id/edits", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(qs(req.params.id));

  const edits = await db
    .select()
    .from(invoiceEditsTable)
    .where(and(eq(invoiceEditsTable.saleId, id), eq(invoiceEditsTable.tenantId, tenantId)))
    .orderBy(desc(invoiceEditsTable.createdAt));

  return res.json(edits);
});

// ─── CREATE SALE ──────────────────────────────────────────────────────────────
router.post("/pos/sales", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const cashierId = req.user!.userId;
  const {
    customerId,
    customerName,
    items,
    payments,
    subtotal,
    discountAmount = 0,
    taxAmount = 0,
    total,
    paidAmount,
    changeAmount = 0,
    loyaltyPointsRedeemed = 0,
    couponCode,
    notes,
  } = req.body;

  const saleNumber = await nextSaleNumber(tenantId);
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

  const insertedItems =
    items && items.length > 0
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

  const insertedPayments =
    payments && payments.length > 0
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

  // Deduct stock
  for (const item of items ?? []) {
    if (item.productId) {
      await db
        .update(productsTable)
        .set({
          stock: sql`${productsTable.stock} - ${Number(item.quantity)}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productsTable.id, item.productId as number),
            eq(productsTable.tenantId, tenantId)
          )
        );
    }
  }

  // Update customer loyalty + purchases
  if (customerId) {
    const [updatedCustomer] = await db
      .update(customersTable)
      .set({
        loyaltyPoints: sql`${customersTable.loyaltyPoints} + ${loyaltyPointsEarned} - ${loyaltyPointsRedeemed}`,
        totalPurchases: sql`${customersTable.totalPurchases} + ${total}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(customersTable.id, customerId), eq(customersTable.tenantId, tenantId))
      )
      .returning();

    if (loyaltyPointsEarned > 0) {
      await db.insert(loyaltyTransactionsTable).values({
        tenantId,
        customerId,
        saleId: sale.id,
        type: "earn",
        points: loyaltyPointsEarned,
        balance: updatedCustomer?.loyaltyPoints ?? 0,
        notes: `Earned on sale ${saleNumber}`,
      });
    }
    if (loyaltyPointsRedeemed > 0) {
      await db.insert(loyaltyTransactionsTable).values({
        tenantId,
        customerId,
        saleId: sale.id,
        type: "redeem",
        points: -loyaltyPointsRedeemed,
        balance: updatedCustomer?.loyaltyPoints ?? 0,
        notes: `Redeemed on sale ${saleNumber}`,
      });
    }
  }

  // Increment coupon usage
  if (couponCode) {
    await db
      .update(couponsTable)
      .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
      .where(
        and(
          eq(couponsTable.code, couponCode),
          eq(couponsTable.tenantId, tenantId)
        )
      );
  }

  res.status(201).json(formatSale(sale, insertedItems, insertedPayments));
});

// ─── HELD BILLS ───────────────────────────────────────────────────────────────
router.get("/pos/held-bills", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const bills = await db
    .select()
    .from(heldBillsTable)
    .where(eq(heldBillsTable.tenantId, tenantId))
    .orderBy(desc(heldBillsTable.createdAt));
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
  const id = parseInt(qs(req.params.id));

  await db
    .delete(heldBillsTable)
    .where(and(eq(heldBillsTable.id, id), eq(heldBillsTable.tenantId, tenantId)));
  res.status(204).end();
});

// ─── CASHIER SESSIONS ─────────────────────────────────────────────────────────
router.get("/pos/sessions", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const status = qs(req.query.status);

  const conditions: ReturnType<typeof eq>[] = [eq(cashierSessionsTable.tenantId, tenantId)];
  if (status) conditions.push(eq(cashierSessionsTable.status, status));

  const sessions = await db
    .select()
    .from(cashierSessionsTable)
    .where(and(...conditions))
    .orderBy(desc(cashierSessionsTable.openedAt))
    .limit(50);

  return res.json(
    sessions.map((s) => ({
      ...s,
      openingCash: numStr(s.openingCash),
      closingCash: s.closingCash ? numStr(s.closingCash) : null,
      expectedCash: s.expectedCash ? numStr(s.expectedCash) : null,
    }))
  );
});

router.get("/pos/sessions/active", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const cashierId = req.user!.userId;

  const [session] = await db
    .select()
    .from(cashierSessionsTable)
    .where(
      and(
        eq(cashierSessionsTable.tenantId, tenantId),
        eq(cashierSessionsTable.cashierId, cashierId),
        eq(cashierSessionsTable.status, "open")
      )
    )
    .orderBy(desc(cashierSessionsTable.openedAt))
    .limit(1);

  return res.json(
    session
      ? {
          ...session,
          openingCash: numStr(session.openingCash),
          closingCash: session.closingCash ? numStr(session.closingCash) : null,
          expectedCash: session.expectedCash ? numStr(session.expectedCash) : null,
        }
      : null
  );
});

router.post("/pos/sessions", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const cashierId = req.user!.userId;
  const { openingCash = 0, notes } = req.body as { openingCash?: number; notes?: string };

  // Close any existing open session for this cashier first
  await db
    .update(cashierSessionsTable)
    .set({ status: "closed", closedAt: new Date() })
    .where(
      and(
        eq(cashierSessionsTable.tenantId, tenantId),
        eq(cashierSessionsTable.cashierId, cashierId),
        eq(cashierSessionsTable.status, "open")
      )
    );

  const [session] = await db
    .insert(cashierSessionsTable)
    .values({ tenantId, cashierId, openingCash: openingCash.toString(), notes: notes ?? null })
    .returning();

  return res.status(201).json({
    ...session,
    openingCash: numStr(session.openingCash),
    closingCash: null,
    expectedCash: null,
  });
});

router.patch("/pos/sessions/:id/close", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(qs(req.params.id));
  const { closingCash = 0, notes } = req.body as { closingCash?: number; notes?: string };

  const [session] = await db
    .select()
    .from(cashierSessionsTable)
    .where(and(eq(cashierSessionsTable.id, id), eq(cashierSessionsTable.tenantId, tenantId)));
  if (!session) return res.status(404).json({ error: "Session not found" });

  // Calculate expected cash (opening + cash sales)
  const [cashSalesRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${paymentsTable.amount}::numeric), 0)` })
    .from(paymentsTable)
    .innerJoin(salesTable, eq(salesTable.id, paymentsTable.saleId))
    .where(
      and(
        eq(paymentsTable.tenantId, tenantId),
        eq(paymentsTable.method, "cash"),
        eq(salesTable.cashierId, session.cashierId),
        gte(salesTable.createdAt, session.openedAt)
      )
    );

  const cashSales = numStr(cashSalesRow?.total);
  const expectedCash = numStr(session.openingCash) + cashSales;

  const [updated] = await db
    .update(cashierSessionsTable)
    .set({
      status: "closed",
      closingCash: closingCash.toString(),
      expectedCash: expectedCash.toString(),
      closedAt: new Date(),
      notes: notes ?? session.notes,
    })
    .where(and(eq(cashierSessionsTable.id, id), eq(cashierSessionsTable.tenantId, tenantId)))
    .returning();

  return res.json({
    ...updated,
    openingCash: numStr(updated!.openingCash),
    closingCash: numStr(updated!.closingCash),
    expectedCash: numStr(updated!.expectedCash),
  });
});

// ─── COUPON VALIDATE ──────────────────────────────────────────────────────────
router.post("/pos/coupons/validate", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { code, orderAmount } = req.body as { code: string; orderAmount: number };

  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(and(eq(couponsTable.tenantId, tenantId), eq(couponsTable.code, code.toUpperCase())));

  if (!coupon) return res.status(404).json({ error: "Coupon not found" });
  if (!coupon.isActive) return res.status(400).json({ error: "Coupon is inactive" });

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom)
    return res.status(400).json({ error: "Coupon not yet valid" });
  if (coupon.validTo && now > coupon.validTo)
    return res.status(400).json({ error: "Coupon has expired" });
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return res.status(400).json({ error: "Coupon usage limit reached" });

  const minOrder = numStr(coupon.minOrderAmount);
  if (orderAmount < minOrder)
    return res.status(400).json({ error: `Minimum order amount is ₹${minOrder.toFixed(2)}` });

  let discountAmount = 0;
  if (coupon.type === "percentage") {
    discountAmount = (orderAmount * numStr(coupon.value)) / 100;
    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, numStr(coupon.maxDiscount));
  } else {
    discountAmount = numStr(coupon.value);
  }
  discountAmount = Math.min(discountAmount, orderAmount);

  return res.json({
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: numStr(coupon.value),
      description: coupon.description,
    },
    discountAmount: Math.round(discountAmount * 100) / 100,
  });
});

// ─── QUICK ADD CUSTOMER FROM POS ─────────────────────────────────────────────
router.post("/pos/customers/quick-add", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { name, phone } = req.body as { name: string; phone?: string };

  if (!name) return res.status(400).json({ error: "Name is required" });

  const [customer] = await db
    .insert(customersTable)
    .values({ tenantId, name, phone: phone ?? null })
    .returning();

  return res.status(201).json({
    ...customer,
    creditLimit: customer.creditLimit ? numStr(customer.creditLimit) : null,
    outstandingDues: numStr(customer.outstandingDues),
    totalPurchases: numStr(customer.totalPurchases),
  });
});

// ─── CUSTOMER PURCHASE HISTORY ────────────────────────────────────────────────
router.get("/pos/customers/:id/history", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const customerId = parseInt(qs(req.params.id));

  const sales = await db
    .select({
      id: salesTable.id,
      saleNumber: salesTable.saleNumber,
      total: salesTable.total,
      paymentStatus: salesTable.paymentStatus,
      loyaltyPointsEarned: salesTable.loyaltyPointsEarned,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .where(and(eq(salesTable.tenantId, tenantId), eq(salesTable.customerId, customerId)))
    .orderBy(desc(salesTable.createdAt))
    .limit(5);

  res.json(sales.map((s) => ({ ...s, total: numStr(s.total) })));
});

// ─── LOYALTY TRANSACTIONS ─────────────────────────────────────────────────────
router.get("/pos/customers/:id/loyalty", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const customerId = parseInt(qs(req.params.id));

  const txns = await db
    .select()
    .from(loyaltyTransactionsTable)
    .where(
      and(
        eq(loyaltyTransactionsTable.tenantId, tenantId),
        eq(loyaltyTransactionsTable.customerId, customerId)
      )
    )
    .orderBy(desc(loyaltyTransactionsTable.createdAt))
    .limit(20);

  res.json(txns);
});

export default router;
