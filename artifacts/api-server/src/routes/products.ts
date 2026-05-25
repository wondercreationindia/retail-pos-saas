import { Router, type IRouter } from "express";
import { eq, and, ilike, isNull } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
  ListProductsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v as string);
  return isNaN(n) ? null : n;
}

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    tenantId: p.tenantId,

    // Core
    name: p.name,
    description: p.description ?? null,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    hsnCode: p.hsnCode ?? null,
    brand: p.brand ?? null,
    unit: p.unit ?? null,
    weight: parseNum(p.weight),
    size: p.size ?? null,
    color: p.color ?? null,

    // Pricing
    price: parseNum(p.price) ?? 0,
    salePrice: parseNum(p.salePrice),
    mrp: parseNum(p.mrp),
    purchasePrice: parseNum(p.purchasePrice),
    costPrice: parseNum(p.costPrice),
    gstRate: parseNum(p.gstRate),

    // Inventory
    stock: p.stock,
    minStockAlert: p.minStockAlert ?? null,
    maxStock: p.maxStock ?? null,
    trackInventory: p.trackInventory,
    allowNegativeStock: p.allowNegativeStock,

    // Category
    categoryId: p.categoryId ?? null,
    imageUrl: p.imageUrl ?? null,

    // E-commerce
    slug: p.slug ?? null,
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
    publishOnline: p.publishOnline,
    featuredProduct: p.featuredProduct,

    // Barcode printing
    barcodeType: p.barcodeType ?? null,
    labelWidth: parseNum(p.labelWidth),
    labelHeight: parseNum(p.labelHeight),

    // Status
    isActive: p.isActive,
    status: p.status,
    supplierId: p.supplierId ?? null,
    createdBy: p.createdBy ?? null,
    updatedBy: p.updatedBy ?? null,
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function buildNumericFields(data: Record<string, unknown>): Record<string, unknown> {
  const numericKeys = ["price", "salePrice", "mrp", "purchasePrice", "costPrice", "gstRate", "weight", "labelWidth", "labelHeight"];
  const out: Record<string, unknown> = { ...data };
  for (const key of numericKeys) {
    if (key in out && out[key] !== undefined && out[key] !== null) {
      out[key] = String(out[key]);
    }
  }
  return out;
}

// List products — scoped to tenant, supports search, categoryId, status filter, excludes soft-deleted
router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const queryParams = ListProductsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { categoryId, search } = queryParams.data;
  const tenantId = req.user!.tenantId;

  let query = db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.tenantId, tenantId), isNull(productsTable.deletedAt)))
    .$dynamic();

  if (categoryId) {
    query = query.where(and(eq(productsTable.tenantId, tenantId), isNull(productsTable.deletedAt), eq(productsTable.categoryId, categoryId)));
  }
  if (search) {
    query = query.where(and(eq(productsTable.tenantId, tenantId), isNull(productsTable.deletedAt), ilike(productsTable.name, `%${search}%`)));
  }

  const products = await query;
  res.json(products.map(formatProduct));
});

// Create product
router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const [product] = await db.insert(productsTable).values({
    tenantId: req.user!.tenantId,
    ...buildNumericFields(parsed.data as Record<string, unknown>),
    createdBy: req.user!.userId,
    updatedBy: req.user!.userId,
    createdAt: now,
    updatedAt: now,
  } as typeof productsTable.$inferInsert).returning();

  res.status(201).json(formatProduct(product!));
});

// Get single product
router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(
    and(
      eq(productsTable.id, params.data.id),
      eq(productsTable.tenantId, req.user!.tenantId),
      isNull(productsTable.deletedAt),
    )
  );

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(formatProduct(product));
});

// Update product
router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData = {
    ...buildNumericFields(parsed.data as Record<string, unknown>),
    updatedBy: req.user!.userId,
    updatedAt: new Date(),
  };

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(and(
      eq(productsTable.id, params.data.id),
      eq(productsTable.tenantId, req.user!.tenantId),
      isNull(productsTable.deletedAt),
    ))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(formatProduct(product));
});

// Soft-delete product
router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .update(productsTable)
    .set({ deletedAt: new Date(), status: "inactive", updatedBy: req.user!.userId })
    .where(and(
      eq(productsTable.id, params.data.id),
      eq(productsTable.tenantId, req.user!.tenantId),
    ));

  res.sendStatus(204);
});

export default router;
