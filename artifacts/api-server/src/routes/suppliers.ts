import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseN(v: unknown) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v as string);
  return isNaN(n) ? null : n;
}

function fmt(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    name: s.name,
    code: s.code ?? null,
    contactName: s.contactName ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
    address: s.address ?? null,
    city: s.city ?? null,
    state: s.state ?? null,
    pincode: s.pincode ?? null,
    country: s.country ?? null,
    gstNumber: s.gstNumber ?? null,
    panNumber: s.panNumber ?? null,
    paymentTerms: s.paymentTerms ?? null,
    creditLimit: parseN(s.creditLimit),
    openingBalance: parseN(s.openingBalance),
    currentBalance: parseN(s.currentBalance),
    notes: s.notes ?? null,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const { search } = req.query as { search?: string };
  const tenantId = req.user!.tenantId;
  let query = db.select().from(suppliersTable).where(eq(suppliersTable.tenantId, tenantId)).$dynamic();
  if (search) {
    query = query.where(and(eq(suppliersTable.tenantId, tenantId), ilike(suppliersTable.name, `%${search}%`)));
  }
  const rows = await query;
  res.json(rows.map(fmt));
});

router.post("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const { name, code, contactName, phone, email, address, city, state, pincode, country, gstNumber, panNumber, paymentTerms, creditLimit, openingBalance, notes, status } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const now = new Date();
  const [row] = await db.insert(suppliersTable).values({
    tenantId: req.user!.tenantId, name, code, contactName, phone, email, address, city, state, pincode, country,
    gstNumber, panNumber, paymentTerms: paymentTerms ? Number(paymentTerms) : undefined,
    creditLimit: creditLimit != null ? String(creditLimit) : undefined,
    openingBalance: openingBalance != null ? String(openingBalance) : undefined,
    currentBalance: openingBalance != null ? String(openingBalance) : undefined,
    notes, status: status ?? "active", createdAt: now, updatedAt: now,
  }).returning();
  res.status(201).json(fmt(row!));
});

router.get("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.tenantId, req.user!.tenantId)));
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(fmt(row));
});

router.patch("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { name, code, contactName, phone, email, address, city, state, pincode, country, gstNumber, panNumber, paymentTerms, creditLimit, notes, status } = req.body;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (code !== undefined) updateData.code = code;
  if (contactName !== undefined) updateData.contactName = contactName;
  if (phone !== undefined) updateData.phone = phone;
  if (email !== undefined) updateData.email = email;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (pincode !== undefined) updateData.pincode = pincode;
  if (country !== undefined) updateData.country = country;
  if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
  if (panNumber !== undefined) updateData.panNumber = panNumber;
  if (paymentTerms !== undefined) updateData.paymentTerms = Number(paymentTerms);
  if (creditLimit !== undefined) updateData.creditLimit = String(creditLimit);
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  const [row] = await db.update(suppliersTable).set(updateData).where(and(eq(suppliersTable.id, id), eq(suppliersTable.tenantId, req.user!.tenantId))).returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(fmt(row));
});

router.delete("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.update(suppliersTable).set({ status: "inactive", updatedAt: new Date() }).where(and(eq(suppliersTable.id, id), eq(suppliersTable.tenantId, req.user!.tenantId)));
  res.sendStatus(204);
});

export default router;
