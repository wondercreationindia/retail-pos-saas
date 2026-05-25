import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql, or, isNull, lt, inArray } from "drizzle-orm";
import {
  db,
  salesTable, saleItemsTable, paymentsTable,
  purchasesTable, purchaseItemsTable,
  productsTable, categoriesTable,
  customersTable, suppliersTable,
  usersTable,
  cashierSessionsTable,
  expensesTable,
  reportExportLogsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const qs = (v: unknown, def = ""): string =>
  typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? (v[0] ?? def) : def;

function dateRange(from: string, to: string) {
  const start = new Date(from + "T00:00:00.000Z");
  const end = new Date(to + "T23:59:59.999Z");
  return { start, end };
}

function today() { return new Date().toISOString().split("T")[0]!; }
function firstOfMonth() { return today().substring(0, 7) + "-01"; }

// ─── SALES REPORT ─────────────────────────────────────────────────────────────

router.get("/reports/sales", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today(), customerId, cashierId, paymentMethod, status = "completed", limit = "500", offset = "0" } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  const conditions = [
    eq(salesTable.tenantId, tenantId),
    gte(salesTable.createdAt, start),
    lte(salesTable.createdAt, end),
  ];
  if (status && status !== "all") conditions.push(eq(salesTable.status, status));
  if (customerId) conditions.push(eq(salesTable.customerId, parseInt(customerId)));
  if (cashierId) conditions.push(eq(salesTable.cashierId, parseInt(cashierId)));

  const rows = await db
    .select({
      id: salesTable.id,
      saleNumber: salesTable.saleNumber,
      date: salesTable.createdAt,
      customerName: salesTable.customerName,
      cashierId: salesTable.cashierId,
      status: salesTable.status,
      subtotal: salesTable.subtotal,
      discountAmount: salesTable.discountAmount,
      taxAmount: salesTable.taxAmount,
      total: salesTable.total,
      paidAmount: salesTable.paidAmount,
      paymentStatus: salesTable.paymentStatus,
      cashierName: usersTable.name,
    })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(salesTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  // Filter by payment method via join if needed
  let filtered = rows;
  if (paymentMethod) {
    const saleIds = await db
      .selectDistinct({ saleId: paymentsTable.saleId })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.tenantId, tenantId), eq(paymentsTable.method, paymentMethod)));
    const ids = saleIds.map((r) => r.saleId);
    filtered = rows.filter((r) => ids.includes(r.id));
  }

  const totals = filtered.reduce((acc, r) => ({
    subtotal: acc.subtotal + parseFloat(String(r.subtotal)),
    discount: acc.discount + parseFloat(String(r.discountAmount)),
    tax: acc.tax + parseFloat(String(r.taxAmount)),
    total: acc.total + parseFloat(String(r.total)),
  }), { subtotal: 0, discount: 0, tax: 0, total: 0 });

  return res.json({
    data: filtered.map((r) => ({
      ...r,
      subtotal: parseFloat(String(r.subtotal)),
      discountAmount: parseFloat(String(r.discountAmount)),
      taxAmount: parseFloat(String(r.taxAmount)),
      total: parseFloat(String(r.total)),
      paidAmount: parseFloat(String(r.paidAmount)),
      date: r.date.toISOString(),
    })),
    totals,
    count: filtered.length,
  });
});

// ─── PURCHASE REPORT ──────────────────────────────────────────────────────────

router.get("/reports/purchases", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today(), supplierId, status, paymentStatus, limit = "500", offset = "0" } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  const conditions = [
    eq(purchasesTable.tenantId, tenantId),
    gte(purchasesTable.createdAt, start),
    lte(purchasesTable.createdAt, end),
  ];
  if (status && status !== "all") conditions.push(eq(purchasesTable.status, status));
  if (paymentStatus) conditions.push(eq(purchasesTable.paymentStatus, paymentStatus));
  if (supplierId) conditions.push(eq(purchasesTable.supplierId, parseInt(supplierId)));

  const rows = await db
    .select({
      id: purchasesTable.id,
      purchaseNumber: purchasesTable.purchaseNumber,
      invoiceNumber: purchasesTable.invoiceNumber,
      date: purchasesTable.createdAt,
      supplierName: suppliersTable.name,
      status: purchasesTable.status,
      paymentStatus: purchasesTable.paymentStatus,
      paymentMethod: purchasesTable.paymentMethod,
      subtotal: purchasesTable.subtotal,
      taxAmount: purchasesTable.taxAmount,
      discountAmount: purchasesTable.discountAmount,
      total: purchasesTable.total,
      paidAmount: purchasesTable.paidAmount,
    })
    .from(purchasesTable)
    .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .where(and(...conditions))
    .orderBy(desc(purchasesTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const totals = rows.reduce((acc, r) => ({
    subtotal: acc.subtotal + parseFloat(String(r.subtotal)),
    tax: acc.tax + parseFloat(String(r.taxAmount)),
    discount: acc.discount + parseFloat(String(r.discountAmount)),
    total: acc.total + parseFloat(String(r.total)),
    paid: acc.paid + parseFloat(String(r.paidAmount)),
  }), { subtotal: 0, tax: 0, discount: 0, total: 0, paid: 0 });

  return res.json({
    data: rows.map((r) => ({
      ...r,
      subtotal: parseFloat(String(r.subtotal)),
      taxAmount: parseFloat(String(r.taxAmount)),
      discountAmount: parseFloat(String(r.discountAmount)),
      total: parseFloat(String(r.total)),
      paidAmount: parseFloat(String(r.paidAmount)),
      date: r.date.toISOString(),
    })),
    totals,
    count: rows.length,
  });
});

// ─── GST REPORT ───────────────────────────────────────────────────────────────

router.get("/reports/gst", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today() } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  // Output GST (from sales)
  const salesGst = await db
    .select({
      gstRate: saleItemsTable.gstRate,
      taxableAmount: sql<string>`SUM(${saleItemsTable.subtotal}::numeric - ${saleItemsTable.gstAmount}::numeric)`,
      gstAmount: sql<string>`SUM(${saleItemsTable.gstAmount}::numeric)`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${saleItemsTable.saleId})`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(and(
      eq(saleItemsTable.tenantId, tenantId),
      eq(salesTable.status, "completed"),
      gte(salesTable.createdAt, start),
      lte(salesTable.createdAt, end),
    ))
    .groupBy(saleItemsTable.gstRate)
    .orderBy(saleItemsTable.gstRate);

  // Input GST (from purchases)
  const purchaseGst = await db
    .select({
      gstRate: purchaseItemsTable.gstRate,
      taxableAmount: sql<string>`SUM(${purchaseItemsTable.subtotal}::numeric - COALESCE(${purchaseItemsTable.gstAmount}::numeric, 0))`,
      gstAmount: sql<string>`SUM(COALESCE(${purchaseItemsTable.gstAmount}::numeric, 0))`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${purchaseItemsTable.purchaseId})`,
    })
    .from(purchaseItemsTable)
    .innerJoin(purchasesTable, eq(purchaseItemsTable.purchaseId, purchasesTable.id))
    .where(and(
      eq(purchaseItemsTable.tenantId, tenantId),
      gte(purchasesTable.createdAt, start),
      lte(purchasesTable.createdAt, end),
    ))
    .groupBy(purchaseItemsTable.gstRate)
    .orderBy(purchaseItemsTable.gstRate);

  const totalOutputGst = salesGst.reduce((s, r) => s + parseFloat(String(r.gstAmount)), 0);
  const totalInputGst = purchaseGst.reduce((s, r) => s + parseFloat(String(r.gstAmount)), 0);

  return res.json({
    dateFrom, dateTo,
    outputGst: {
      rows: salesGst.map((r) => ({
        gstRate: parseFloat(String(r.gstRate ?? 0)),
        taxableAmount: parseFloat(String(r.taxableAmount)),
        gstAmount: parseFloat(String(r.gstAmount)),
        invoiceCount: Number(r.invoiceCount),
      })),
      total: totalOutputGst,
    },
    inputGst: {
      rows: purchaseGst.map((r) => ({
        gstRate: parseFloat(String(r.gstRate ?? 0)),
        taxableAmount: parseFloat(String(r.taxableAmount)),
        gstAmount: parseFloat(String(r.gstAmount)),
        invoiceCount: Number(r.invoiceCount),
      })),
      total: totalInputGst,
    },
    netPayable: totalOutputGst - totalInputGst,
  });
});

// ─── STOCK VALUATION REPORT ───────────────────────────────────────────────────

router.get("/reports/stock-valuation", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { categoryId, search } = req.query as Record<string, string>;

  const conditions = [eq(productsTable.tenantId, tenantId), eq(productsTable.isActive, true)];
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId)));
  if (search) conditions.push(sql`(${productsTable.name} ILIKE ${"%" + search + "%"} OR ${productsTable.sku} ILIKE ${"%" + search + "%"})`);

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryName: categoriesTable.name,
      unit: productsTable.unit,
      stock: productsTable.stock,
      costPrice: productsTable.costPrice,
      purchasePrice: productsTable.purchasePrice,
      price: productsTable.price,
      mrp: productsTable.mrp,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(productsTable.name);

  const data = rows.map((r) => {
    const cost = parseFloat(String(r.costPrice ?? r.purchasePrice ?? 0));
    const retail = parseFloat(String(r.price));
    const stock = Number(r.stock);
    return {
      ...r,
      costPrice: cost,
      purchasePrice: parseFloat(String(r.purchasePrice ?? 0)),
      price: retail,
      mrp: parseFloat(String(r.mrp ?? 0)),
      stock,
      costValue: cost * stock,
      retailValue: retail * stock,
    };
  });

  const totals = data.reduce((acc, r) => ({
    totalStock: acc.totalStock + r.stock,
    totalCostValue: acc.totalCostValue + r.costValue,
    totalRetailValue: acc.totalRetailValue + r.retailValue,
  }), { totalStock: 0, totalCostValue: 0, totalRetailValue: 0 });

  return res.json({ data, totals, count: data.length });
});

// ─── LOW STOCK REPORT ─────────────────────────────────────────────────────────

router.get("/reports/low-stock", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { categoryId } = req.query as Record<string, string>;

  const conditions = [
    eq(productsTable.tenantId, tenantId),
    eq(productsTable.isActive, true),
    eq(productsTable.trackInventory, true),
    sql`${productsTable.stock} <= COALESCE(${productsTable.minStockAlert}, 10)`,
  ];
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId)));

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryName: categoriesTable.name,
      unit: productsTable.unit,
      stock: productsTable.stock,
      minStockAlert: productsTable.minStockAlert,
      price: productsTable.price,
      costPrice: productsTable.costPrice,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(productsTable.stock);

  return res.json({
    data: rows.map((r) => ({
      ...r,
      stock: Number(r.stock),
      minStockAlert: Number(r.minStockAlert ?? 10),
      price: parseFloat(String(r.price)),
      costPrice: parseFloat(String(r.costPrice ?? 0)),
      shortage: Math.max(0, Number(r.minStockAlert ?? 10) - Number(r.stock)),
    })),
    count: rows.length,
  });
});

// ─── DEAD STOCK REPORT ────────────────────────────────────────────────────────

router.get("/reports/dead-stock", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { days = "90" } = req.query as Record<string, string>;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(days));

  // Products with no sale items in the last N days
  const recentlySold = await db
    .selectDistinct({ productId: saleItemsTable.productId })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(and(
      eq(saleItemsTable.tenantId, tenantId),
      gte(salesTable.createdAt, cutoff),
      eq(salesTable.status, "completed"),
    ));

  const recentIds = recentlySold.map((r) => r.productId).filter((x): x is number => x !== null);

  let query = db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      categoryName: categoriesTable.name,
      stock: productsTable.stock,
      price: productsTable.price,
      costPrice: productsTable.costPrice,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id));

  const baseConditions = [
    eq(productsTable.tenantId, tenantId),
    eq(productsTable.isActive, true),
    sql`${productsTable.stock} > 0`,
  ];

  const rows = recentIds.length > 0
    ? await query.where(and(...baseConditions, sql`${productsTable.id} NOT IN (${sql.join(recentIds.map((id) => sql`${id}`), sql`, `)})`)).orderBy(desc(productsTable.stock))
    : await query.where(and(...baseConditions)).orderBy(desc(productsTable.stock));

  return res.json({
    data: rows.map((r) => ({
      ...r,
      stock: Number(r.stock),
      price: parseFloat(String(r.price)),
      costPrice: parseFloat(String(r.costPrice ?? 0)),
      stockValue: parseFloat(String(r.costPrice ?? r.price)) * Number(r.stock),
    })),
    count: rows.length,
    noSaleDays: parseInt(days),
  });
});

// ─── CUSTOMER LEDGER REPORT ───────────────────────────────────────────────────

router.get("/reports/customer-ledger", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today(), customerId } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  if (customerId) {
    // Single customer detail
    const [customer] = await db.select().from(customersTable)
      .where(and(eq(customersTable.id, parseInt(customerId)), eq(customersTable.tenantId, tenantId)));
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const sales = await db
      .select({
        id: salesTable.id,
        saleNumber: salesTable.saleNumber,
        date: salesTable.createdAt,
        total: salesTable.total,
        paidAmount: salesTable.paidAmount,
        paymentStatus: salesTable.paymentStatus,
        status: salesTable.status,
      })
      .from(salesTable)
      .where(and(
        eq(salesTable.tenantId, tenantId),
        eq(salesTable.customerId, parseInt(customerId)),
        gte(salesTable.createdAt, start),
        lte(salesTable.createdAt, end),
      ))
      .orderBy(salesTable.createdAt);

    const totalPurchases = sales.reduce((s, r) => s + parseFloat(String(r.total)), 0);
    const totalPaid = sales.reduce((s, r) => s + parseFloat(String(r.paidAmount)), 0);

    return res.json({
      customer,
      transactions: sales.map((r) => ({
        ...r,
        total: parseFloat(String(r.total)),
        paidAmount: parseFloat(String(r.paidAmount)),
        date: r.date.toISOString(),
      })),
      totalPurchases,
      totalPaid,
      outstanding: totalPurchases - totalPaid,
    });
  }

  // Summary by customer
  const rows = await db
    .select({
      customerId: salesTable.customerId,
      customerName: salesTable.customerName,
      totalSales: sql<string>`COUNT(*)`,
      totalAmount: sql<string>`SUM(${salesTable.total}::numeric)`,
      totalPaid: sql<string>`SUM(${salesTable.paidAmount}::numeric)`,
    })
    .from(salesTable)
    .where(and(
      eq(salesTable.tenantId, tenantId),
      eq(salesTable.status, "completed"),
      gte(salesTable.createdAt, start),
      lte(salesTable.createdAt, end),
    ))
    .groupBy(salesTable.customerId, salesTable.customerName)
    .orderBy(desc(sql`SUM(${salesTable.total}::numeric)`));

  return res.json({
    data: rows.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName ?? "Walk-in",
      totalSales: Number(r.totalSales),
      totalAmount: parseFloat(String(r.totalAmount)),
      totalPaid: parseFloat(String(r.totalPaid)),
      outstanding: parseFloat(String(r.totalAmount)) - parseFloat(String(r.totalPaid)),
    })),
    count: rows.length,
  });
});

// ─── SUPPLIER LEDGER REPORT ───────────────────────────────────────────────────

router.get("/reports/supplier-ledger", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today(), supplierId } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  if (supplierId) {
    const [supplier] = await db.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, parseInt(supplierId)), eq(suppliersTable.tenantId, tenantId)));
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });

    const purchases = await db
      .select({
        id: purchasesTable.id,
        purchaseNumber: purchasesTable.purchaseNumber,
        invoiceNumber: purchasesTable.invoiceNumber,
        date: purchasesTable.createdAt,
        total: purchasesTable.total,
        paidAmount: purchasesTable.paidAmount,
        paymentStatus: purchasesTable.paymentStatus,
        status: purchasesTable.status,
      })
      .from(purchasesTable)
      .where(and(
        eq(purchasesTable.tenantId, tenantId),
        eq(purchasesTable.supplierId, parseInt(supplierId)),
        gte(purchasesTable.createdAt, start),
        lte(purchasesTable.createdAt, end),
      ))
      .orderBy(purchasesTable.createdAt);

    const totalPurchases = purchases.reduce((s, r) => s + parseFloat(String(r.total)), 0);
    const totalPaid = purchases.reduce((s, r) => s + parseFloat(String(r.paidAmount)), 0);

    return res.json({
      supplier,
      transactions: purchases.map((r) => ({
        ...r,
        total: parseFloat(String(r.total)),
        paidAmount: parseFloat(String(r.paidAmount)),
        date: r.date.toISOString(),
      })),
      totalPurchases,
      totalPaid,
      outstanding: totalPurchases - totalPaid,
    });
  }

  const rows = await db
    .select({
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      totalOrders: sql<string>`COUNT(*)`,
      totalAmount: sql<string>`SUM(${purchasesTable.total}::numeric)`,
      totalPaid: sql<string>`SUM(${purchasesTable.paidAmount}::numeric)`,
    })
    .from(purchasesTable)
    .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .where(and(
      eq(purchasesTable.tenantId, tenantId),
      gte(purchasesTable.createdAt, start),
      lte(purchasesTable.createdAt, end),
    ))
    .groupBy(purchasesTable.supplierId, suppliersTable.name)
    .orderBy(desc(sql`SUM(${purchasesTable.total}::numeric)`));

  return res.json({
    data: rows.map((r) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName ?? "Unknown",
      totalOrders: Number(r.totalOrders),
      totalAmount: parseFloat(String(r.totalAmount)),
      totalPaid: parseFloat(String(r.totalPaid)),
      outstanding: parseFloat(String(r.totalAmount)) - parseFloat(String(r.totalPaid)),
    })),
    count: rows.length,
  });
});

// ─── PAYMENT COLLECTION REPORT ────────────────────────────────────────────────

router.get("/reports/payment-collection", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today(), cashierId } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  const conditions = [
    eq(paymentsTable.tenantId, tenantId),
    gte(salesTable.createdAt, start),
    lte(salesTable.createdAt, end),
    eq(salesTable.status, "completed"),
  ];
  if (cashierId) conditions.push(eq(salesTable.cashierId, parseInt(cashierId)));

  const byMethod = await db
    .select({
      method: paymentsTable.method,
      count: sql<number>`COUNT(*)`,
      total: sql<string>`SUM(${paymentsTable.amount}::numeric)`,
    })
    .from(paymentsTable)
    .innerJoin(salesTable, eq(paymentsTable.saleId, salesTable.id))
    .where(and(...conditions))
    .groupBy(paymentsTable.method)
    .orderBy(desc(sql`SUM(${paymentsTable.amount}::numeric)`));

  const daily = await db
    .select({
      date: sql<string>`DATE(${salesTable.createdAt})::text`,
      total: sql<string>`SUM(${paymentsTable.amount}::numeric)`,
      count: sql<number>`COUNT(DISTINCT ${paymentsTable.saleId})`,
    })
    .from(paymentsTable)
    .innerJoin(salesTable, eq(paymentsTable.saleId, salesTable.id))
    .where(and(...conditions))
    .groupBy(sql`DATE(${salesTable.createdAt})`)
    .orderBy(sql`DATE(${salesTable.createdAt})`);

  const grandTotal = byMethod.reduce((s, r) => s + parseFloat(String(r.total)), 0);

  return res.json({
    byMethod: byMethod.map((r) => ({
      method: r.method,
      count: Number(r.count),
      total: parseFloat(String(r.total)),
      percentage: grandTotal > 0 ? Math.round((parseFloat(String(r.total)) / grandTotal) * 100 * 10) / 10 : 0,
    })),
    daily: daily.map((r) => ({
      date: r.date,
      total: parseFloat(String(r.total)),
      count: Number(r.count),
    })),
    grandTotal,
  });
});

// ─── CASHIER SHIFT REPORT ─────────────────────────────────────────────────────

router.get("/reports/cashier-shift", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = today(), dateTo = today(), cashierId } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  const conditions = [
    eq(salesTable.tenantId, tenantId),
    gte(salesTable.createdAt, start),
    lte(salesTable.createdAt, end),
    eq(salesTable.status, "completed"),
  ];
  if (cashierId) conditions.push(eq(salesTable.cashierId, parseInt(cashierId)));

  const byCashier = await db
    .select({
      cashierId: salesTable.cashierId,
      cashierName: usersTable.name,
      salesCount: sql<number>`COUNT(*)`,
      totalSales: sql<string>`SUM(${salesTable.total}::numeric)`,
      totalDiscount: sql<string>`SUM(${salesTable.discountAmount}::numeric)`,
      totalTax: sql<string>`SUM(${salesTable.taxAmount}::numeric)`,
      avgBasket: sql<string>`AVG(${salesTable.total}::numeric)`,
    })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.cashierId, usersTable.id))
    .where(and(...conditions))
    .groupBy(salesTable.cashierId, usersTable.name)
    .orderBy(desc(sql`SUM(${salesTable.total}::numeric)`));

  // Payment methods per cashier
  const payments = await db
    .select({
      cashierId: salesTable.cashierId,
      method: paymentsTable.method,
      total: sql<string>`SUM(${paymentsTable.amount}::numeric)`,
    })
    .from(paymentsTable)
    .innerJoin(salesTable, eq(paymentsTable.saleId, salesTable.id))
    .where(and(...conditions))
    .groupBy(salesTable.cashierId, paymentsTable.method);

  const paymentMap: Record<number | string, Record<string, number>> = {};
  for (const p of payments) {
    const key = p.cashierId ?? 0;
    (paymentMap[key] ??= {})[p.method] = parseFloat(String(p.total));
  }

  return res.json({
    data: byCashier.map((r) => ({
      cashierId: r.cashierId,
      cashierName: r.cashierName ?? "Unknown",
      salesCount: Number(r.salesCount),
      totalSales: parseFloat(String(r.totalSales)),
      totalDiscount: parseFloat(String(r.totalDiscount)),
      totalTax: parseFloat(String(r.totalTax)),
      avgBasket: parseFloat(String(r.avgBasket)),
      paymentBreakdown: paymentMap[r.cashierId ?? 0] ?? {},
    })),
    count: byCashier.length,
  });
});

// ─── EXPENSE REPORT ───────────────────────────────────────────────────────────

router.get("/reports/expenses", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = firstOfMonth(), dateTo = today(), status, category } = req.query as Record<string, string>;
  const { start, end } = dateRange(dateFrom, dateTo);

  const conditions = [
    eq(expensesTable.tenantId, tenantId),
    gte(expensesTable.date, dateFrom),
    lte(expensesTable.date, dateTo),
  ];
  if (status && status !== "all") conditions.push(eq(expensesTable.status, status));
  if (category) conditions.push(eq(expensesTable.category, category));

  const rows = await db.select().from(expensesTable)
    .where(and(...conditions))
    .orderBy(desc(expensesTable.date));

  const byCategory = rows.reduce<Record<string, { count: number; total: number }>>((acc, r) => {
    const cat = r.category;
    (acc[cat] ??= { count: 0, total: 0 }).count++;
    (acc[cat]).total += parseFloat(String(r.totalAmount));
    return acc;
  }, {});

  const totals = {
    total: rows.reduce((s, r) => s + parseFloat(String(r.totalAmount)), 0),
    gst: rows.reduce((s, r) => s + parseFloat(String(r.gstAmount ?? 0)), 0),
    approved: rows.filter((r) => r.status === "approved").reduce((s, r) => s + parseFloat(String(r.totalAmount)), 0),
  };

  return res.json({
    data: rows.map((r) => ({
      ...r,
      amount: parseFloat(String(r.amount)),
      gstAmount: parseFloat(String(r.gstAmount ?? 0)),
      totalAmount: parseFloat(String(r.totalAmount)),
    })),
    byCategory: Object.entries(byCategory).map(([cat, v]) => ({ category: cat, ...v })),
    totals,
    count: rows.length,
  });
});

// ─── DAILY CLOSING REPORT ─────────────────────────────────────────────────────

router.get("/reports/daily-closing", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom = today(), dateTo = today() } = req.query as Record<string, string>;

  const days: unknown[] = [];
  const d = new Date(dateFrom + "T00:00:00.000Z");
  const end = new Date(dateTo + "T00:00:00.000Z");

  while (d <= end) {
    const dayStr = d.toISOString().split("T")[0]!;
    const { start: dayStart, end: dayEnd } = dateRange(dayStr, dayStr);

    const [sales] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(${salesTable.total}::numeric), 0)`,
        tax: sql<string>`COALESCE(SUM(${salesTable.taxAmount}::numeric), 0)`,
        discount: sql<string>`COALESCE(SUM(${salesTable.discountAmount}::numeric), 0)`,
      })
      .from(salesTable)
      .where(and(
        eq(salesTable.tenantId, tenantId),
        eq(salesTable.status, "completed"),
        gte(salesTable.createdAt, dayStart),
        lte(salesTable.createdAt, dayEnd),
      ));

    const payments = await db
      .select({
        method: paymentsTable.method,
        total: sql<string>`SUM(${paymentsTable.amount}::numeric)`,
      })
      .from(paymentsTable)
      .innerJoin(salesTable, eq(paymentsTable.saleId, salesTable.id))
      .where(and(
        eq(paymentsTable.tenantId, tenantId),
        eq(salesTable.status, "completed"),
        gte(salesTable.createdAt, dayStart),
        lte(salesTable.createdAt, dayEnd),
      ))
      .groupBy(paymentsTable.method);

    const [expenses] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expensesTable.totalAmount}::numeric), 0)` })
      .from(expensesTable)
      .where(and(
        eq(expensesTable.tenantId, tenantId),
        eq(expensesTable.date, dayStr),
        eq(expensesTable.status, "approved"),
      ));

    const payBreakdown: Record<string, number> = {};
    for (const p of payments) payBreakdown[p.method] = parseFloat(String(p.total));

    days.push({
      date: dayStr,
      salesCount: Number(sales?.count ?? 0),
      totalSales: parseFloat(String(sales?.total ?? 0)),
      totalTax: parseFloat(String(sales?.tax ?? 0)),
      totalDiscount: parseFloat(String(sales?.discount ?? 0)),
      totalExpenses: parseFloat(String(expenses?.total ?? 0)),
      paymentBreakdown: payBreakdown,
      netCash: parseFloat(String(sales?.total ?? 0)) - parseFloat(String(expenses?.total ?? 0)),
    });

    d.setDate(d.getDate() + 1);
  }

  return res.json({ data: days, count: days.length });
});

// ─── LOG EXPORT ───────────────────────────────────────────────────────────────

router.post("/reports/log-export", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { reportType, exportFormat, filters, rowCount } = req.body as {
    reportType: string; exportFormat: string; filters?: object; rowCount?: number;
  };

  await db.insert(reportExportLogsTable).values({
    tenantId,
    userId: req.user!.userId,
    reportType,
    exportFormat,
    filters: filters ?? {},
    rowCount: rowCount ?? 0,
  });

  return res.status(201).json({ ok: true });
});

export default router;
