import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import { CreateCategoryBody, UpdateCategoryBody, UpdateCategoryParams, DeleteCategoryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function formatCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    description: c.description ?? null,
    color: c.color ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.tenantId, req.user!.tenantId));
  res.json(cats.map(formatCategory));
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [cat] = await db.insert(categoriesTable).values({
    tenantId: req.user!.tenantId,
    ...parsed.data,
  }).returning();

  res.status(201).json(formatCategory(cat!));
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [cat] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(formatCategory(cat));
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(categoriesTable).where(
    and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.tenantId, req.user!.tenantId))
  );
  res.sendStatus(204);
});

export default router;
