import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
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

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    description: p.description ?? null,
    sku: p.sku ?? null,
    price: parseFloat(p.price as string),
    stock: p.stock,
    categoryId: p.categoryId ?? null,
    imageUrl: p.imageUrl ?? null,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const queryParams = ListProductsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { categoryId, search } = queryParams.data;
  let query = db.select().from(productsTable).where(eq(productsTable.tenantId, req.user!.tenantId)).$dynamic();

  if (categoryId) {
    query = query.where(and(eq(productsTable.tenantId, req.user!.tenantId), eq(productsTable.categoryId, categoryId)));
  }
  if (search) {
    query = query.where(and(eq(productsTable.tenantId, req.user!.tenantId), ilike(productsTable.name, `%${search}%`)));
  }

  const products = await query;
  res.json(products.map(formatProduct));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    tenantId: req.user!.tenantId,
    ...parsed.data,
    price: String(parsed.data.price),
  }).returning();

  res.status(201).json(formatProduct(product!));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(
    and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, req.user!.tenantId))
  );

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(formatProduct(product));
});

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

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (typeof parsed.data.price === "number") {
    updateData.price = String(parsed.data.price);
  }

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(formatProduct(product));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(productsTable).where(
    and(eq(productsTable.id, params.data.id), eq(productsTable.tenantId, req.user!.tenantId))
  );
  res.sendStatus(204);
});

export default router;
