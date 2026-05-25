import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { db, customersTable } from "@workspace/db";
import { eq, and, isNull, ilike, or, desc } from "drizzle-orm";

const router = Router();

router.get("/customers", requireAuth, async (req, res) => {
  const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const tenantId = req.user!.tenantId;

  const conditions = [eq(customersTable.tenantId, tenantId), isNull(customersTable.deletedAt)];
  if (search) {
    conditions.push(
      or(
        ilike(customersTable.name, `%${search}%`),
        ilike(customersTable.phone!, `%${search}%`),
        ilike(customersTable.email!, `%${search}%`)
      )!
    );
  }

  const rows = await db
    .select()
    .from(customersTable)
    .where(and(...conditions))
    .orderBy(desc(customersTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const customers = rows.map((c) => ({
    ...c,
    creditLimit: c.creditLimit ? parseFloat(c.creditLimit) : null,
    outstandingDues: parseFloat(c.outstandingDues),
    totalPurchases: parseFloat(c.totalPurchases),
  }));

  res.json(customers);
});

router.post("/customers", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { name, phone, email, gstin, address, city, state, pincode, isCredit, creditLimit, notes } = req.body;

  const [customer] = await db
    .insert(customersTable)
    .values({ tenantId, name, phone, email, gstin, address, city, state, pincode, isCredit: !!isCredit, creditLimit: creditLimit?.toString(), notes })
    .returning();

  res.status(201).json({
    ...customer,
    creditLimit: customer.creditLimit ? parseFloat(customer.creditLimit) : null,
    outstandingDues: parseFloat(customer.outstandingDues),
    totalPurchases: parseFloat(customer.totalPurchases),
  });
});

router.get("/customers/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(req.params.id);

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, id), eq(customersTable.tenantId, tenantId), isNull(customersTable.deletedAt)));

  if (!customer) return res.status(404).json({ error: "Customer not found" });

  res.json({
    ...customer,
    creditLimit: customer.creditLimit ? parseFloat(customer.creditLimit) : null,
    outstandingDues: parseFloat(customer.outstandingDues),
    totalPurchases: parseFloat(customer.totalPurchases),
  });
});

router.patch("/customers/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(req.params.id);
  const { name, phone, email, gstin, address, city, state, pincode, isCredit, creditLimit, notes } = req.body;

  const [customer] = await db
    .update(customersTable)
    .set({ name, phone, email, gstin, address, city, state, pincode, isCredit: isCredit !== undefined ? !!isCredit : undefined, creditLimit: creditLimit?.toString(), notes, updatedAt: new Date() })
    .where(and(eq(customersTable.id, id), eq(customersTable.tenantId, tenantId)))
    .returning();

  if (!customer) return res.status(404).json({ error: "Customer not found" });

  res.json({
    ...customer,
    creditLimit: customer.creditLimit ? parseFloat(customer.creditLimit) : null,
    outstandingDues: parseFloat(customer.outstandingDues),
    totalPurchases: parseFloat(customer.totalPurchases),
  });
});

router.delete("/customers/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(req.params.id);

  await db
    .update(customersTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(customersTable.id, id), eq(customersTable.tenantId, tenantId)));

  res.status(204).end();
});

export default router;
