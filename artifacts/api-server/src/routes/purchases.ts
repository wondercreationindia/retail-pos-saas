import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, purchasesTable, purchaseItemsTable, productsTable, inventoryLogsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseN(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v as string);
  return isNaN(n) ? null : n;
}

function fmtPurchase(p: typeof purchasesTable.$inferSelect) {
  return {
    id: p.id, tenantId: p.tenantId, supplierId: p.supplierId ?? null,
    purchaseNumber: p.purchaseNumber, invoiceNumber: p.invoiceNumber ?? null,
    invoiceDate: p.invoiceDate ?? null, dueDate: p.dueDate ?? null,
    status: p.status,
    subtotal: parseN(p.subtotal) ?? 0, taxAmount: parseN(p.taxAmount) ?? 0,
    discountAmount: parseN(p.discountAmount) ?? 0, total: parseN(p.total) ?? 0,
    paidAmount: parseN(p.paidAmount) ?? 0,
    paymentStatus: p.paymentStatus, paymentMethod: p.paymentMethod ?? null,
    notes: p.notes ?? null, createdBy: p.createdBy ?? null,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

function fmtItem(i: typeof purchaseItemsTable.$inferSelect) {
  return {
    id: i.id, purchaseId: i.purchaseId, productId: i.productId ?? null,
    productName: i.productName,
    quantity: parseN(i.quantity) ?? 0, receivedQuantity: parseN(i.receivedQuantity) ?? 0,
    unitPrice: parseN(i.unitPrice) ?? 0, mrp: parseN(i.mrp),
    gstRate: parseN(i.gstRate), gstAmount: parseN(i.gstAmount),
    discountAmount: parseN(i.discountAmount), subtotal: parseN(i.subtotal) ?? 0,
    total: parseN(i.total) ?? 0, batchNumber: i.batchNumber ?? null,
    expiryDate: i.expiryDate ?? null,
  };
}

function genPurchaseNumber(): string {
  return `PO-${Date.now().toString().slice(-8)}`;
}

// List purchases
router.get("/purchases", requireAuth, async (req, res): Promise<void> => {
  const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const tenantId = req.user!.tenantId;
  let query = db.select().from(purchasesTable)
    .where(eq(purchasesTable.tenantId, tenantId))
    .orderBy(desc(purchasesTable.createdAt))
    .limit(Number(limit)).offset(Number(offset))
    .$dynamic();
  if (status) query = query.where(and(eq(purchasesTable.tenantId, tenantId), eq(purchasesTable.status, status)));
  const rows = await query;
  res.json(rows.map(fmtPurchase));
});

// Create purchase
router.post("/purchases", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const { supplierId, invoiceNumber, invoiceDate, dueDate, notes, items = [] } = req.body;

  const now = new Date();
  let subtotal = 0, taxAmount = 0, total = 0;
  for (const item of items) {
    subtotal += parseFloat(item.subtotal ?? 0);
    taxAmount += parseFloat(item.gstAmount ?? 0);
    total += parseFloat(item.total ?? item.subtotal ?? 0);
  }

  const [purchase] = await db.insert(purchasesTable).values({
    tenantId, supplierId: supplierId ? Number(supplierId) : undefined,
    purchaseNumber: genPurchaseNumber(), invoiceNumber, invoiceDate, dueDate,
    status: "draft",
    subtotal: String(subtotal), taxAmount: String(taxAmount),
    discountAmount: "0", total: String(total), paidAmount: "0",
    paymentStatus: "unpaid", notes, createdBy: req.user!.userId, createdAt: now, updatedAt: now,
  }).returning();

  const insertedItems = [];
  for (const item of items) {
    const [pi] = await db.insert(purchaseItemsTable).values({
      tenantId, purchaseId: purchase!.id,
      productId: item.productId ? Number(item.productId) : undefined,
      productName: item.productName ?? "Unknown",
      quantity: String(item.quantity), receivedQuantity: "0",
      unitPrice: String(item.unitPrice), mrp: item.mrp ? String(item.mrp) : undefined,
      gstRate: item.gstRate ? String(item.gstRate) : "0",
      gstAmount: item.gstAmount ? String(item.gstAmount) : "0",
      discountAmount: "0",
      subtotal: String(item.subtotal ?? item.unitPrice * item.quantity),
      total: String(item.total ?? item.subtotal ?? item.unitPrice * item.quantity),
      batchNumber: item.batchNumber, expiryDate: item.expiryDate,
    }).returning();
    insertedItems.push(pi!);
  }

  res.status(201).json({ ...fmtPurchase(purchase!), items: insertedItems.map(fmtItem) });
});

// Get purchase with items
router.get("/purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const [purchase] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.id, id), eq(purchasesTable.tenantId, tenantId)));
  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));
  res.json({ ...fmtPurchase(purchase), items: items.map(fmtItem) });
});

// Update purchase status (receive stock)
router.patch("/purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const { status, paidAmount, paymentMethod, notes } = req.body;
  const [purchase] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.id, id), eq(purchasesTable.tenantId, tenantId)));
  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (paidAmount !== undefined) {
    updateData.paidAmount = String(paidAmount);
    const paid = parseFloat(String(paidAmount));
    const total = parseN(purchase.total) ?? 0;
    updateData.paymentStatus = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";
  }
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
  if (notes !== undefined) updateData.notes = notes;

  const [updated] = await db.update(purchasesTable).set(updateData).where(eq(purchasesTable.id, id)).returning();

  // If marking as received, update product stocks and create inventory logs
  if (status === "received") {
    const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));
    for (const item of items) {
      if (!item.productId) continue;
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (!product) continue;
      const qty = parseN(item.quantity) ?? 0;
      const beforeQty = product.stock;
      const afterQty = beforeQty + qty;
      await db.update(productsTable).set({ stock: Math.round(afterQty), updatedAt: new Date() }).where(eq(productsTable.id, item.productId));
      await db.update(purchaseItemsTable).set({ receivedQuantity: item.quantity }).where(eq(purchaseItemsTable.id, item.id));
      await db.insert(inventoryLogsTable).values({
        tenantId, productId: item.productId, type: "stock_in",
        quantity: item.quantity, beforeQuantity: String(beforeQty), afterQuantity: String(afterQty),
        unitCost: item.unitPrice,
        batchNumber: item.batchNumber ?? undefined, expiryDate: item.expiryDate ?? undefined,
        referenceType: "purchase", referenceId: id,
        createdBy: req.user!.userId,
      });
    }
  }

  res.json(fmtPurchase(updated!));
});

// Delete purchase (draft only)
router.delete("/purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [purchase] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.id, id), eq(purchasesTable.tenantId, req.user!.tenantId)));
  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
  if (purchase.status !== "draft") { res.status(400).json({ error: "Only draft purchases can be deleted" }); return; }
  await db.delete(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));
  await db.delete(purchasesTable).where(eq(purchasesTable.id, id));
  res.sendStatus(204);
});

export default router;
