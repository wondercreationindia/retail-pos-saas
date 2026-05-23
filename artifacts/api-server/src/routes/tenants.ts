import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { UpdateTenantBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function formatTenant(t: typeof tenantsTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    logoUrl: t.logoUrl ?? null,
    currency: t.currency,
    timezone: t.timezone,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/tenants/current", requireAuth, async (req, res): Promise<void> => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.user!.tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(formatTenant(tenant));
});

router.patch("/tenants/current", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tenant] = await db
    .update(tenantsTable)
    .set(parsed.data)
    .where(eq(tenantsTable.id, req.user!.tenantId))
    .returning();

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(formatTenant(tenant));
});

export default router;
