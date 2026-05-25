import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte, isNull, lt, sql } from "drizzle-orm";
import { db, inventoryLogsTable, stockAdjustmentsTable, stockTransfersTable, productsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseN(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v as string);
  return isNaN(n) ? null : n;
}

function fmtLog(l: typeof inventoryLogsTable.$inferSelect) {
  return {
    id: l.id, tenantId: l.tenantId, productId: l.productId,
    type: l.type,
    quantity: parseN(l.quantity), beforeQuantity: parseN(l.beforeQuantity), afterQuantity: parseN(l.afterQuantity),
    unitCost: parseN(l.unitCost), batchNumber: l.batchNumber ?? null,
    expiryDate: l.expiryDate ?? null, referenceType: l.referenceType ?? null,
    referenceId: l.referenceId ?? null, notes: l.notes ?? null,
    createdBy: l.createdBy ?? null, createdAt: l.createdAt.toISOString(),
  };
}

function fmtAdj(a: typeof stockAdjustmentsTable.$inferSelect) {
  return {
    id: a.id, tenantId: a.tenantId, productId: a.productId,
    adjustmentType: a.adjustmentType,
    quantity: parseN(a.quantity), beforeQuantity: parseN(a.beforeQuantity), afterQuantity: parseN(a.afterQuantity),
    unitCost: parseN(a.unitCost), reason: a.reason ?? null, notes: a.notes ?? null,
    referenceNumber: a.referenceNumber ?? null, createdBy: a.createdBy ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

function fmtTransfer(t: typeof stockTransfersTable.$inferSelect) {
  return {
    id: t.id, tenantId: t.tenantId, productId: t.productId,
    transferNumber: t.transferNumber, fromLocation: t.fromLocation, toLocation: t.toLocation,
    quantity: parseN(t.quantity), beforeQuantity: parseN(t.beforeQuantity), afterQuantity: parseN(t.afterQuantity),
    status: t.status, notes: t.notes ?? null, createdBy: t.createdBy ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

// --- Inventory Overview ---
router.get("/inventory/overview", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const products = await db.select().from(productsTable).where(and(eq(productsTable.tenantId, tenantId), isNull(productsTable.deletedAt)));

  const totalProducts = products.length;
  const totalStockValue = products.reduce((sum, p) => {
    const cost = parseN(p.costPrice) ?? parseN(p.purchasePrice) ?? parseN(p.price) ?? 0;
    return sum + (cost * p.stock);
  }, 0);
  const totalRetailValue = products.reduce((sum, p) => sum + ((parseN(p.price) ?? 0) * p.stock), 0);
  const lowStockProducts = products.filter(p => p.stock < (p.minStockAlert ?? 10)).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const activeProducts = products.filter(p => p.isActive).length;

  res.json({ totalProducts, activeProducts, totalStockValue, totalRetailValue, lowStockProducts, outOfStock });
});

// --- Low Stock Products ---
router.get("/inventory/low-stock", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const products = await db.select().from(productsTable).where(and(eq(productsTable.tenantId, tenantId), isNull(productsTable.deletedAt)));
  const lowStock = products
    .filter(p => p.stock < (p.minStockAlert ?? 10))
    .map(p => ({
      id: p.id, name: p.name, sku: p.sku, stock: p.stock,
      minStockAlert: p.minStockAlert ?? 10,
      price: parseN(p.price), categoryId: p.categoryId,
    }))
    .sort((a, b) => a.stock - b.stock);
  res.json(lowStock);
});

// --- Inventory Logs ---
router.get("/inventory/logs", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const { productId, type, limit = "50", offset = "0" } = req.query as Record<string, string>;
  let query = db.select().from(inventoryLogsTable)
    .where(eq(inventoryLogsTable.tenantId, tenantId))
    .orderBy(desc(inventoryLogsTable.createdAt))
    .limit(Number(limit))
    .offset(Number(offset))
    .$dynamic();
  if (productId) query = query.where(and(eq(inventoryLogsTable.tenantId, tenantId), eq(inventoryLogsTable.productId, Number(productId))));
  if (type) query = query.where(and(eq(inventoryLogsTable.tenantId, tenantId), eq(inventoryLogsTable.type, type)));
  const rows = await query;
  res.json(rows.map(fmtLog));
});

// --- Stock Adjustments ---
router.get("/inventory/adjustments", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const rows = await db.select().from(stockAdjustmentsTable)
    .where(eq(stockAdjustmentsTable.tenantId, tenantId))
    .orderBy(desc(stockAdjustmentsTable.createdAt))
    .limit(Number(limit)).offset(Number(offset));
  res.json(rows.map(fmtAdj));
});

router.post("/inventory/adjustments", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const { productId, adjustmentType, quantity, reason, notes, referenceNumber, unitCost } = req.body;
  if (!productId || !adjustmentType || quantity == null) {
    res.status(400).json({ error: "productId, adjustmentType, quantity are required" }); return;
  }

  // Fetch current stock
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, Number(productId)), eq(productsTable.tenantId, tenantId)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const beforeQty = product.stock;
  const qty = parseFloat(String(quantity));
  const isAddition = ["add", "recount"].includes(adjustmentType);
  const isDamageOrExpiry = ["damage", "expiry", "remove"].includes(adjustmentType);
  let afterQty: number;
  if (adjustmentType === "recount") {
    afterQty = qty;
  } else if (isAddition) {
    afterQty = beforeQty + qty;
  } else {
    afterQty = beforeQty - qty;
  }

  // Insert adjustment
  const [adj] = await db.insert(stockAdjustmentsTable).values({
    tenantId, productId: Number(productId), adjustmentType,
    quantity: String(qty), beforeQuantity: String(beforeQty), afterQuantity: String(afterQty),
    unitCost: unitCost != null ? String(unitCost) : undefined,
    reason, notes, referenceNumber,
    createdBy: req.user!.userId,
  }).returning();

  // Update product stock
  await db.update(productsTable).set({ stock: Math.round(afterQty), updatedAt: new Date() }).where(eq(productsTable.id, Number(productId)));

  // Write inventory log
  const logType = adjustmentType === "add" ? "stock_in" : adjustmentType === "remove" ? "stock_out" : adjustmentType;
  await db.insert(inventoryLogsTable).values({
    tenantId, productId: Number(productId), type: logType,
    quantity: String(Math.abs(qty)), beforeQuantity: String(beforeQty), afterQuantity: String(afterQty),
    unitCost: unitCost != null ? String(unitCost) : undefined,
    referenceType: "adjustment", referenceId: adj!.id,
    notes, createdBy: req.user!.userId,
  });

  res.status(201).json(fmtAdj(adj!));
});

// --- Stock Transfers ---
router.get("/inventory/transfers", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;
  const rows = await db.select().from(stockTransfersTable)
    .where(eq(stockTransfersTable.tenantId, tenantId))
    .orderBy(desc(stockTransfersTable.createdAt))
    .limit(Number(limit)).offset(Number(offset));
  res.json(rows.map(fmtTransfer));
});

router.post("/inventory/transfers", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const { productId, fromLocation = "main", toLocation, quantity, notes } = req.body;
  if (!productId || !toLocation || quantity == null) {
    res.status(400).json({ error: "productId, toLocation, quantity are required" }); return;
  }
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, Number(productId)), eq(productsTable.tenantId, tenantId)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  const qty = parseFloat(String(quantity));
  const beforeQty = product.stock;
  const afterQty = beforeQty - qty;
  const transferNumber = `TRF-${Date.now()}`;
  const [transfer] = await db.insert(stockTransfersTable).values({
    tenantId, productId: Number(productId), transferNumber,
    fromLocation, toLocation, quantity: String(qty),
    beforeQuantity: String(beforeQty), afterQuantity: String(afterQty),
    status: "completed", notes, createdBy: req.user!.userId,
  }).returning();
  await db.update(productsTable).set({ stock: Math.round(afterQty), updatedAt: new Date() }).where(eq(productsTable.id, Number(productId)));
  await db.insert(inventoryLogsTable).values({
    tenantId, productId: Number(productId), type: "transfer_out",
    quantity: String(qty), beforeQuantity: String(beforeQty), afterQuantity: String(afterQty),
    referenceType: "transfer", referenceId: transfer!.id,
    notes, createdBy: req.user!.userId,
  });
  res.status(201).json(fmtTransfer(transfer!));
});

export default router;
