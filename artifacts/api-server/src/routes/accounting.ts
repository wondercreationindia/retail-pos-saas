import { Router } from "express";
import { requireAuth } from "../lib/auth";
import {
  db,
  accountsTable,
  journalEntriesTable,
  journalItemsTable,
  vouchersTable,
  expensesTable,
  ledgerTransactionsTable,
  salesTable,
  paymentsTable,
  purchasesTable,
  customersTable,
  suppliersTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte, sql, inArray, isNull, ne, asc } from "drizzle-orm";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const qs = (v: unknown, def = ""): string =>
  typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? (v[0] ?? def) : def;

function n(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const x = parseFloat(String(v));
  return isNaN(x) ? 0 : x;
}

function fmtAccount(a: typeof accountsTable.$inferSelect) {
  return {
    id: a.id, tenantId: a.tenantId, code: a.code, name: a.name,
    type: a.type, group: a.group ?? null, parentId: a.parentId ?? null,
    isGroup: a.isGroup, isSystem: a.isSystem,
    openingBalance: n(a.openingBalance),
    openingBalanceDate: a.openingBalanceDate ?? null,
    description: a.description ?? null,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function fmtEntry(e: typeof journalEntriesTable.$inferSelect, items: typeof journalItemsTable.$inferSelect[] = []) {
  return {
    id: e.id, tenantId: e.tenantId, entryNumber: e.entryNumber,
    date: e.date, description: e.description,
    referenceType: e.referenceType ?? null, referenceId: e.referenceId ?? null,
    referenceNumber: e.referenceNumber ?? null,
    status: e.status, totalDebit: n(e.totalDebit), totalCredit: n(e.totalCredit),
    narration: e.narration ?? null, createdBy: e.createdBy ?? null,
    createdAt: e.createdAt.toISOString(),
    items: items.map((i) => ({
      id: i.id, entryId: i.entryId, accountId: i.accountId,
      debit: n(i.debit), credit: n(i.credit),
      description: i.description ?? null,
      partyType: i.partyType ?? null, partyId: i.partyId ?? null,
      partyName: i.partyName ?? null,
    })),
  };
}

function fmtVoucher(v: typeof vouchersTable.$inferSelect) {
  return {
    id: v.id, tenantId: v.tenantId, voucherNumber: v.voucherNumber,
    type: v.type, date: v.date, amount: n(v.amount),
    accountId: v.accountId ?? null, contraAccountId: v.contraAccountId ?? null,
    partyType: v.partyType ?? null, partyId: v.partyId ?? null, partyName: v.partyName ?? null,
    description: v.description, reference: v.reference ?? null,
    status: v.status, journalEntryId: v.journalEntryId ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

function fmtExpense(e: typeof expensesTable.$inferSelect) {
  return {
    id: e.id, tenantId: e.tenantId, expenseNumber: e.expenseNumber,
    date: e.date, category: e.category, amount: n(e.amount),
    gstAmount: n(e.gstAmount), totalAmount: n(e.totalAmount),
    vendor: e.vendor ?? null, description: e.description,
    paymentMethod: e.paymentMethod ?? null,
    accountId: e.accountId ?? null, paidFromAccountId: e.paidFromAccountId ?? null,
    status: e.status, approvedBy: e.approvedBy ?? null,
    approvedAt: e.approvedAt ? e.approvedAt.toISOString() : null,
    journalEntryId: e.journalEntryId ?? null,
    attachmentUrl: e.attachmentUrl ?? null,
    isRecurring: e.isRecurring,
    recurrencePeriod: e.recurrencePeriod ?? null,
    notes: e.notes ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

function fmtLedger(lt: typeof ledgerTransactionsTable.$inferSelect) {
  return {
    id: lt.id, accountId: lt.accountId,
    journalEntryId: lt.journalEntryId,
    date: lt.date, description: lt.description,
    debit: n(lt.debit), credit: n(lt.credit), balance: n(lt.balance),
    referenceType: lt.referenceType ?? null, referenceId: lt.referenceId ?? null,
    referenceNumber: lt.referenceNumber ?? null,
    partyType: lt.partyType ?? null, partyId: lt.partyId ?? null,
    partyName: lt.partyName ?? null,
    createdAt: lt.createdAt.toISOString(),
  };
}

// ─── Auto-number generators ───────────────────────────────────────────────────

function genJournalNumber(tenantId: number): string {
  return `JE-${tenantId}-${Date.now().toString().slice(-8)}`;
}
function genVoucherNumber(type: string): string {
  const prefix: Record<string, string> = { payment: "PV", receipt: "RV", journal: "JV", contra: "CV" };
  return `${prefix[type] ?? "VCH"}-${Date.now().toString().slice(-8)}`;
}
function genExpenseNumber(): string {
  return `EXP-${Date.now().toString().slice(-8)}`;
}

// ─── Core: Post Journal Entry (with ledger update) ───────────────────────────

async function postJournalEntry(params: {
  tenantId: number;
  date: string;
  description: string;
  narration?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  referenceNumber?: string | null;
  createdBy?: number | null;
  items: Array<{
    accountId: number;
    debit: number;
    credit: number;
    description?: string | null;
    partyType?: string | null;
    partyId?: number | null;
    partyName?: string | null;
  }>;
}): Promise<typeof journalEntriesTable.$inferSelect> {
  const { tenantId, date, description, narration, referenceType, referenceId, referenceNumber, createdBy, items } = params;

  // Validate balance
  const totalDebit = items.reduce((s, i) => s + i.debit, 0);
  const totalCredit = items.reduce((s, i) => s + i.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Journal entry not balanced: debit ${totalDebit.toFixed(2)} ≠ credit ${totalCredit.toFixed(2)}`);
  }

  const [entry] = await db.insert(journalEntriesTable).values({
    tenantId,
    entryNumber: genJournalNumber(tenantId),
    date,
    description,
    narration: narration ?? null,
    referenceType: referenceType ?? null,
    referenceId: referenceId ?? null,
    referenceNumber: referenceNumber ?? null,
    status: "posted",
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
    createdBy: createdBy ?? null,
  }).returning();

  if (!entry) throw new Error("Failed to create journal entry");

  // Insert items
  for (const item of items) {
    await db.insert(journalItemsTable).values({
      tenantId,
      entryId: entry.id,
      accountId: item.accountId,
      debit: item.debit.toFixed(2),
      credit: item.credit.toFixed(2),
      description: item.description ?? null,
      partyType: item.partyType ?? null,
      partyId: item.partyId ?? null,
      partyName: item.partyName ?? null,
    });
  }

  // Update ledger transactions with running balance
  for (const item of items) {
    // Compute running balance for this account
    const [balRow] = await db
      .select({ bal: sql<string>`COALESCE(SUM(debit) - SUM(credit), 0)` })
      .from(ledgerTransactionsTable)
      .where(and(eq(ledgerTransactionsTable.tenantId, tenantId), eq(ledgerTransactionsTable.accountId, item.accountId)));

    // Get account opening balance
    const [acct] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.id, item.accountId), eq(accountsTable.tenantId, tenantId)));

    const openingBal = n(acct?.openingBalance ?? 0);
    const currentBal = openingBal + n(balRow?.bal ?? 0);
    const newBalance = currentBal + item.debit - item.credit;

    await db.insert(ledgerTransactionsTable).values({
      tenantId,
      accountId: item.accountId,
      journalEntryId: entry.id,
      date,
      description: item.description ?? description,
      debit: item.debit.toFixed(2),
      credit: item.credit.toFixed(2),
      balance: newBalance.toFixed(2),
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      referenceNumber: referenceNumber ?? null,
      partyType: item.partyType ?? null,
      partyId: item.partyId ?? null,
      partyName: item.partyName ?? null,
    });
  }

  return entry;
}

// ─── Reverse a journal entry (for void) ──────────────────────────────────────

async function reverseJournalEntry(entryId: number, tenantId: number, reason: string, createdBy?: number | null) {
  const [original] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, entryId), eq(journalEntriesTable.tenantId, tenantId)));
  if (!original) throw new Error("Entry not found");
  if (original.status === "voided") throw new Error("Already voided");

  const items = await db.select().from(journalItemsTable).where(eq(journalItemsTable.entryId, entryId));
  const today = new Date().toISOString().split("T")[0]!;

  // Create reversal entry (flip debit/credit)
  await postJournalEntry({
    tenantId,
    date: today,
    description: `REVERSAL: ${original.description}`,
    narration: reason,
    referenceType: "reversal",
    referenceId: entryId,
    referenceNumber: original.entryNumber,
    createdBy,
    items: items.map((i) => ({
      accountId: i.accountId,
      debit: n(i.credit),
      credit: n(i.debit),
      description: `Reversal: ${i.description ?? ""}`,
      partyType: i.partyType ?? null,
      partyId: i.partyId ?? null,
      partyName: i.partyName ?? null,
    })),
  });

  // Mark original as voided
  const [voided] = await db.update(journalEntriesTable)
    .set({ status: "voided", updatedAt: new Date() })
    .where(eq(journalEntriesTable.id, entryId))
    .returning();

  return voided!;
}

// ─── Default Chart of Accounts ───────────────────────────────────────────────

const DEFAULT_ACCOUNTS = [
  // Assets
  { code: "1000", name: "Assets", type: "asset", group: "Root", isGroup: true, isSystem: true },
  { code: "1100", name: "Current Assets", type: "asset", group: "Current Assets", isGroup: true, isSystem: true, parentCode: "1000" },
  { code: "1101", name: "Cash in Hand", type: "asset", group: "Current Assets", isSystem: true, parentCode: "1100" },
  { code: "1102", name: "Bank Account", type: "asset", group: "Current Assets", isSystem: true, parentCode: "1100" },
  { code: "1103", name: "Petty Cash", type: "asset", group: "Current Assets", parentCode: "1100" },
  { code: "1200", name: "Accounts Receivable", type: "asset", group: "Current Assets", isSystem: true, parentCode: "1100" },
  { code: "1300", name: "GST Input Credit (ITC)", type: "asset", group: "Current Assets", isSystem: true, parentCode: "1100" },
  { code: "1400", name: "Inventory / Stock in Hand", type: "asset", group: "Current Assets", isSystem: true, parentCode: "1100" },
  { code: "1500", name: "Fixed Assets", type: "asset", group: "Fixed Assets", isGroup: true, isSystem: true, parentCode: "1000" },
  { code: "1501", name: "Furniture & Fixtures", type: "asset", group: "Fixed Assets", parentCode: "1500" },
  { code: "1502", name: "Computer & Equipment", type: "asset", group: "Fixed Assets", parentCode: "1500" },
  // Liabilities
  { code: "2000", name: "Liabilities", type: "liability", group: "Root", isGroup: true, isSystem: true },
  { code: "2100", name: "Current Liabilities", type: "liability", group: "Current Liabilities", isGroup: true, isSystem: true, parentCode: "2000" },
  { code: "2101", name: "Accounts Payable", type: "liability", group: "Current Liabilities", isSystem: true, parentCode: "2100" },
  { code: "2102", name: "GST Output Payable", type: "liability", group: "Current Liabilities", isSystem: true, parentCode: "2100" },
  { code: "2103", name: "CGST Payable", type: "liability", group: "Current Liabilities", parentCode: "2100" },
  { code: "2104", name: "SGST Payable", type: "liability", group: "Current Liabilities", parentCode: "2100" },
  { code: "2105", name: "IGST Payable", type: "liability", group: "Current Liabilities", parentCode: "2100" },
  { code: "2106", name: "TDS Payable", type: "liability", group: "Current Liabilities", parentCode: "2100" },
  { code: "2200", name: "Long-Term Liabilities", type: "liability", group: "Long-Term Liabilities", isGroup: true, parentCode: "2000" },
  { code: "2201", name: "Bank Loan", type: "liability", group: "Long-Term Liabilities", parentCode: "2200" },
  // Income
  { code: "3000", name: "Income", type: "income", group: "Root", isGroup: true, isSystem: true },
  { code: "3001", name: "Sales Revenue", type: "income", group: "Income", isSystem: true, parentCode: "3000" },
  { code: "3002", name: "Service Income", type: "income", group: "Income", parentCode: "3000" },
  { code: "3003", name: "Other Income", type: "income", group: "Income", parentCode: "3000" },
  { code: "3004", name: "Discount Received", type: "income", group: "Income", parentCode: "3000" },
  // Expenses
  { code: "4000", name: "Expenses", type: "expense", group: "Root", isGroup: true, isSystem: true },
  { code: "4001", name: "Cost of Goods Sold", type: "expense", group: "Direct Expenses", isSystem: true, parentCode: "4000" },
  { code: "4002", name: "Purchase Expenses", type: "expense", group: "Direct Expenses", parentCode: "4000" },
  { code: "4100", name: "Operating Expenses", type: "expense", group: "Operating Expenses", isGroup: true, parentCode: "4000" },
  { code: "4101", name: "Salaries & Wages", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4102", name: "Rent", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4103", name: "Utilities (Electricity/Water)", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4104", name: "Marketing & Advertising", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4105", name: "Office Supplies", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4106", name: "Transport & Logistics", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4107", name: "Repairs & Maintenance", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4108", name: "Professional Fees", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4109", name: "Bank Charges", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4110", name: "Miscellaneous Expenses", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  { code: "4111", name: "Discount Allowed", type: "expense", group: "Operating Expenses", parentCode: "4100" },
  // Capital
  { code: "5000", name: "Capital", type: "capital", group: "Root", isGroup: true, isSystem: true },
  { code: "5001", name: "Owner's Capital", type: "capital", group: "Capital", isSystem: true, parentCode: "5000" },
  { code: "5002", name: "Retained Earnings", type: "capital", group: "Capital", isSystem: true, parentCode: "5000" },
  { code: "5003", name: "Drawings", type: "capital", group: "Capital", parentCode: "5000" },
] as const;

// ─── CHART OF ACCOUNTS ────────────────────────────────────────────────────────

router.get("/accounting/accounts", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const type = qs(req.query.type);
  const includeInactive = qs(req.query.includeInactive) === "true";

  const conditions = [eq(accountsTable.tenantId, tenantId)];
  if (type) conditions.push(eq(accountsTable.type, type));
  if (!includeInactive) conditions.push(eq(accountsTable.isActive, true));

  const rows = await db.select().from(accountsTable)
    .where(and(...conditions))
    .orderBy(asc(accountsTable.code));

  return res.json(rows.map(fmtAccount));
});

router.post("/accounting/accounts/seed", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db.select({ code: accountsTable.code }).from(accountsTable)
    .where(eq(accountsTable.tenantId, tenantId));
  const existingCodes = new Set(existing.map((e) => e.code));

  // Build code->id map for parent references
  const codeToId: Record<string, number> = {};
  let created = 0;

  for (const def of DEFAULT_ACCOUNTS) {
    if (existingCodes.has(def.code)) continue;
    const parentId = "parentCode" in def ? codeToId[def.parentCode] ?? null : null;
    const [acc] = await db.insert(accountsTable).values({
      tenantId,
      code: def.code,
      name: def.name,
      type: def.type,
      group: def.group,
      parentId,
      isGroup: "isGroup" in def ? Boolean(def.isGroup) : false,
      isSystem: "isSystem" in def ? Boolean(def.isSystem) : false,
      openingBalance: "0",
    }).returning();
    if (acc) { codeToId[def.code] = acc.id; created++; }
  }
  return res.status(201).json({ created });
});

router.post("/accounting/accounts", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { code, name, type, group, parentId, isGroup, openingBalance, openingBalanceDate, description } = req.body as {
    code: string; name: string; type: string; group?: string; parentId?: number;
    isGroup?: boolean; openingBalance?: number; openingBalanceDate?: string; description?: string;
  };

  // Check duplicate code
  const [existing] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.tenantId, tenantId), eq(accountsTable.code, code)));
  if (existing) return res.status(400).json({ error: `Account code ${code} already exists` });

  const [acc] = await db.insert(accountsTable).values({
    tenantId, code, name, type,
    group: group ?? null, parentId: parentId ?? null,
    isGroup: isGroup ?? false, isSystem: false,
    openingBalance: String(openingBalance ?? 0),
    openingBalanceDate: openingBalanceDate ?? null,
    description: description ?? null,
  }).returning();

  return res.status(201).json(fmtAccount(acc!));
});

router.patch("/accounting/accounts/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [acct] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, id), eq(accountsTable.tenantId, tenantId)));
  if (!acct) return res.status(404).json({ error: "Account not found" });

  const { name, group, description, isGroup, openingBalance, openingBalanceDate, isActive } = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (group !== undefined) updateData.group = group;
  if (description !== undefined) updateData.description = description;
  if (isGroup !== undefined) updateData.isGroup = isGroup;
  if (openingBalance !== undefined) updateData.openingBalance = String(openingBalance);
  if (openingBalanceDate !== undefined) updateData.openingBalanceDate = openingBalanceDate;
  if (isActive !== undefined) updateData.isActive = isActive;

  const [updated] = await db.update(accountsTable).set(updateData)
    .where(eq(accountsTable.id, id)).returning();

  return res.json(fmtAccount(updated!));
});

router.delete("/accounting/accounts/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [acct] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, id), eq(accountsTable.tenantId, tenantId)));
  if (!acct) return res.status(404).json({ error: "Account not found" });
  if (acct.isSystem) return res.status(400).json({ error: "System accounts cannot be deleted" });

  // Check if account has transactions
  const [hasLedger] = await db.select({ cnt: sql<number>`count(*)::int` })
    .from(ledgerTransactionsTable).where(eq(ledgerTransactionsTable.accountId, id));
  if ((hasLedger?.cnt ?? 0) > 0) return res.status(400).json({ error: "Cannot delete account with transactions" });

  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  return res.status(204).end();
});

// ─── JOURNAL ENTRIES ──────────────────────────────────────────────────────────

router.get("/accounting/journals", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom, dateTo, referenceType, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions = [eq(journalEntriesTable.tenantId, tenantId)];
  if (dateFrom) conditions.push(gte(journalEntriesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(journalEntriesTable.date, dateTo));
  if (referenceType) conditions.push(eq(journalEntriesTable.referenceType, referenceType));

  const rows = await db.select().from(journalEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(journalEntriesTable.date), desc(journalEntriesTable.id))
    .limit(Number(limit)).offset(Number(offset));

  return res.json(rows.map((e) => fmtEntry(e)));
});

router.post("/accounting/journals", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { date, description, narration, referenceType, referenceNumber, items } = req.body as {
    date: string; description: string; narration?: string;
    referenceType?: string; referenceNumber?: string;
    items: Array<{ accountId: number; debit: number; credit: number; description?: string; partyType?: string; partyId?: number; partyName?: string }>;
  };

  try {
    const entry = await postJournalEntry({
      tenantId, date, description, narration,
      referenceType: referenceType ?? "manual",
      referenceNumber: referenceNumber ?? null,
      createdBy: req.user!.userId,
      items,
    });
    const dbItems = await db.select().from(journalItemsTable).where(eq(journalItemsTable.entryId, entry.id));
    return res.status(201).json(fmtEntry(entry, dbItems));
  } catch (err: unknown) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/accounting/journals/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [entry] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.tenantId, tenantId)));
  if (!entry) return res.status(404).json({ error: "Entry not found" });

  const items = await db.select().from(journalItemsTable).where(eq(journalItemsTable.entryId, id));
  return res.json(fmtEntry(entry, items));
});

router.post("/accounting/journals/:id/void", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const { reason } = req.body as { reason: string };

  try {
    const voided = await reverseJournalEntry(id, tenantId, reason, req.user!.userId);
    return res.json(fmtEntry(voided));
  } catch (err: unknown) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ─── VOUCHERS ─────────────────────────────────────────────────────────────────

router.get("/accounting/vouchers", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { type, dateFrom, dateTo, limit = "50" } = req.query as Record<string, string>;

  const conditions = [eq(vouchersTable.tenantId, tenantId)];
  if (type) conditions.push(eq(vouchersTable.type, type));
  if (dateFrom) conditions.push(gte(vouchersTable.date, dateFrom));
  if (dateTo) conditions.push(lte(vouchersTable.date, dateTo));

  const rows = await db.select().from(vouchersTable)
    .where(and(...conditions))
    .orderBy(desc(vouchersTable.date), desc(vouchersTable.id))
    .limit(Number(limit));

  return res.json(rows.map(fmtVoucher));
});

router.post("/accounting/vouchers", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { type, date, amount, accountId, contraAccountId, partyType, partyId, partyName, description, reference } = req.body as {
    type: string; date: string; amount: number; accountId: number; contraAccountId: number;
    partyType?: string; partyId?: number; partyName?: string; description: string; reference?: string;
  };

  // Build double-entry items based on voucher type
  // Payment: DR contraAccount (expense/payable), CR accountId (cash/bank)
  // Receipt: DR accountId (cash/bank), CR contraAccount (receivable/income)
  // Contra: DR accountId, CR contraAccount (cash→bank transfer)
  // Journal: DR accountId, CR contraAccount (manual)
  let debitAccountId: number, creditAccountId: number;
  if (type === "payment") {
    debitAccountId = contraAccountId;
    creditAccountId = accountId;
  } else if (type === "receipt") {
    debitAccountId = accountId;
    creditAccountId = contraAccountId;
  } else {
    debitAccountId = accountId;
    creditAccountId = contraAccountId;
  }

  const amt = parseFloat(String(amount));

  let entry: typeof journalEntriesTable.$inferSelect;
  try {
    entry = await postJournalEntry({
      tenantId, date, description: description,
      narration: `${type.toUpperCase()} Voucher`,
      referenceType: type,
      createdBy: req.user!.userId,
      items: [
        { accountId: debitAccountId, debit: amt, credit: 0, description, partyType: partyType ?? null, partyId: partyId ?? null, partyName: partyName ?? null },
        { accountId: creditAccountId, debit: 0, credit: amt, description, partyType: partyType ?? null, partyId: partyId ?? null, partyName: partyName ?? null },
      ],
    });
  } catch (err: unknown) {
    return res.status(400).json({ error: (err as Error).message });
  }

  const [voucher] = await db.insert(vouchersTable).values({
    tenantId,
    voucherNumber: genVoucherNumber(type),
    type, date,
    amount: String(amt),
    accountId: accountId ?? null,
    contraAccountId: contraAccountId ?? null,
    partyType: partyType ?? null,
    partyId: partyId ?? null,
    partyName: partyName ?? null,
    description, reference: reference ?? null,
    status: "posted",
    journalEntryId: entry.id,
    createdBy: req.user!.userId,
  }).returning();

  return res.status(201).json(fmtVoucher(voucher!));
});

router.get("/accounting/vouchers/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [v] = await db.select().from(vouchersTable)
    .where(and(eq(vouchersTable.id, id), eq(vouchersTable.tenantId, tenantId)));
  if (!v) return res.status(404).json({ error: "Voucher not found" });
  return res.json(fmtVoucher(v));
});

router.delete("/accounting/vouchers/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [v] = await db.select().from(vouchersTable)
    .where(and(eq(vouchersTable.id, id), eq(vouchersTable.tenantId, tenantId)));
  if (!v) return res.status(404).json({ error: "Voucher not found" });
  if (v.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });

  // Reverse the journal entry
  if (v.journalEntryId) {
    try {
      await reverseJournalEntry(v.journalEntryId, tenantId, `Voucher ${v.voucherNumber} cancelled`, req.user!.userId);
    } catch { /* ignore if already voided */ }
  }

  await db.update(vouchersTable).set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(vouchersTable.id, id));

  return res.status(204).end();
});

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORY_ACCOUNT: Record<string, string> = {
  "Rent": "4102",
  "Utilities": "4103",
  "Salaries": "4101",
  "Marketing": "4104",
  "Office Supplies": "4105",
  "Transport": "4106",
  "Repairs": "4107",
  "Professional Fees": "4108",
  "Bank Charges": "4109",
  "Miscellaneous": "4110",
};

router.get("/accounting/expenses", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, category, dateFrom, dateTo, limit = "50" } = req.query as Record<string, string>;

  const conditions = [eq(expensesTable.tenantId, tenantId)];
  if (status) conditions.push(eq(expensesTable.status, status));
  if (category) conditions.push(eq(expensesTable.category, category));
  if (dateFrom) conditions.push(gte(expensesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(expensesTable.date, dateTo));

  const rows = await db.select().from(expensesTable)
    .where(and(...conditions))
    .orderBy(desc(expensesTable.date), desc(expensesTable.id))
    .limit(Number(limit));

  return res.json(rows.map(fmtExpense));
});

router.post("/accounting/expenses", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { date, category, amount, gstAmount = 0, vendor, description, paymentMethod = "cash",
    accountId, paidFromAccountId, isRecurring = false, recurrencePeriod, notes, attachmentUrl } = req.body as {
    date: string; category: string; amount: number; gstAmount?: number; vendor?: string;
    description: string; paymentMethod?: string; accountId?: number; paidFromAccountId?: number;
    isRecurring?: boolean; recurrencePeriod?: string; notes?: string; attachmentUrl?: string;
  };

  const totalAmount = parseFloat(String(amount)) + parseFloat(String(gstAmount));

  const [expense] = await db.insert(expensesTable).values({
    tenantId,
    expenseNumber: genExpenseNumber(),
    date,
    category,
    amount: String(amount),
    gstAmount: String(gstAmount),
    totalAmount: String(totalAmount),
    vendor: vendor ?? null,
    description,
    paymentMethod: paymentMethod ?? "cash",
    accountId: accountId ?? null,
    paidFromAccountId: paidFromAccountId ?? null,
    status: "pending",
    isRecurring,
    recurrencePeriod: recurrencePeriod ?? null,
    notes: notes ?? null,
    attachmentUrl: attachmentUrl ?? null,
    createdBy: req.user!.userId,
  }).returning();

  return res.status(201).json(fmtExpense(expense!));
});

router.get("/accounting/expenses/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [exp] = await db.select().from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.tenantId, tenantId)));
  if (!exp) return res.status(404).json({ error: "Expense not found" });
  return res.json(fmtExpense(exp));
});

router.patch("/accounting/expenses/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [exp] = await db.select().from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.tenantId, tenantId)));
  if (!exp) return res.status(404).json({ error: "Expense not found" });

  const { status, notes, category, amount, gstAmount, description, vendor, paymentMethod, paidFromAccountId } = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (status !== undefined) {
    updateData.status = status;
    if (status === "approved") {
      updateData.approvedBy = req.user!.userId;
      updateData.approvedAt = new Date();

      // Auto-post journal entry when approved
      const expenseAmt = n(exp.amount);
      const gstAmt = n(exp.gstAmount);

      // Find expense account (by code or default to 4110)
      const expCode = EXPENSE_CATEGORY_ACCOUNT[exp.category] ?? "4110";
      const [expAcct] = await db.select().from(accountsTable)
        .where(and(eq(accountsTable.tenantId, tenantId), eq(accountsTable.code, expCode)));

      // Find cash account (1101) or specified paid-from account
      const paidFromId = exp.paidFromAccountId;
      let cashAcct = null;
      if (paidFromId) {
        [cashAcct] = await db.select().from(accountsTable)
          .where(and(eq(accountsTable.id, paidFromId), eq(accountsTable.tenantId, tenantId)));
      }
      if (!cashAcct) {
        [cashAcct] = await db.select().from(accountsTable)
          .where(and(eq(accountsTable.tenantId, tenantId), eq(accountsTable.code, "1101")));
      }

      if (expAcct && cashAcct) {
        const items: Parameters<typeof postJournalEntry>[0]["items"] = [
          { accountId: expAcct.id, debit: expenseAmt, credit: 0, description: exp.description },
          { accountId: cashAcct.id, debit: 0, credit: expenseAmt, description: exp.description },
        ];

        // If there's GST, debit GST Input Credit
        if (gstAmt > 0) {
          const [gstAcct] = await db.select().from(accountsTable)
            .where(and(eq(accountsTable.tenantId, tenantId), eq(accountsTable.code, "1300")));
          if (gstAcct) {
            items.push({ accountId: gstAcct.id, debit: gstAmt, credit: 0, description: "GST Input Credit" });
            items[1]!.credit = expenseAmt + gstAmt;
          }
        }

        try {
          const entry = await postJournalEntry({
            tenantId, date: exp.date,
            description: `Expense: ${exp.category} — ${exp.description}`,
            referenceType: "expense", referenceId: id,
            referenceNumber: exp.expenseNumber,
            createdBy: req.user!.userId,
            items,
          });
          updateData.journalEntryId = entry.id;
        } catch { /* journal posting error — log but don't fail */ }
      }
    }
  }

  if (notes !== undefined) updateData.notes = notes;
  if (category !== undefined) updateData.category = category;
  if (amount !== undefined) {
    updateData.amount = String(amount);
    updateData.totalAmount = String(n(amount) + n(gstAmount ?? exp.gstAmount));
  }
  if (gstAmount !== undefined) updateData.gstAmount = String(gstAmount);
  if (description !== undefined) updateData.description = description;
  if (vendor !== undefined) updateData.vendor = vendor;
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
  if (paidFromAccountId !== undefined) updateData.paidFromAccountId = paidFromAccountId;

  const [updated] = await db.update(expensesTable).set(updateData)
    .where(eq(expensesTable.id, id)).returning();
  return res.json(fmtExpense(updated!));
});

router.delete("/accounting/expenses/:id", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const id = parseInt(String(req.params.id ?? "0"));
  const [exp] = await db.select().from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.tenantId, tenantId)));
  if (!exp) return res.status(404).json({ error: "Expense not found" });
  if (exp.status === "approved") return res.status(400).json({ error: "Cannot delete approved expense" });
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  return res.status(204).end();
});

// ─── LEDGER ───────────────────────────────────────────────────────────────────

router.get("/accounting/ledger/:accountId", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const accountId = parseInt(String(req.params.accountId ?? "0"));
  const { dateFrom, dateTo, limit = "200" } = req.query as Record<string, string>;

  const [account] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, accountId), eq(accountsTable.tenantId, tenantId)));
  if (!account) return res.status(404).json({ error: "Account not found" });

  const conditions = [
    eq(ledgerTransactionsTable.tenantId, tenantId),
    eq(ledgerTransactionsTable.accountId, accountId),
  ];
  if (dateFrom) conditions.push(gte(ledgerTransactionsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(ledgerTransactionsTable.date, dateTo));

  const transactions = await db.select().from(ledgerTransactionsTable)
    .where(and(...conditions))
    .orderBy(asc(ledgerTransactionsTable.date), asc(ledgerTransactionsTable.id))
    .limit(Number(limit));

  // Compute running balance from scratch
  const openingBal = n(account.openingBalance);
  let running = openingBal;
  const rows = transactions.map((lt) => {
    running += n(lt.debit) - n(lt.credit);
    return { ...fmtLedger(lt), balance: running };
  });

  return res.json({
    account: fmtAccount(account),
    openingBalance: openingBal,
    transactions: rows,
    closingBalance: running,
  });
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

router.get("/accounting/reports/trial-balance", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions = [
    eq(ledgerTransactionsTable.tenantId, tenantId),
  ];
  if (dateFrom) conditions.push(gte(ledgerTransactionsTable.date, dateFrom));
  if (dateTo) conditions.push(lte(ledgerTransactionsTable.date, dateTo));

  const rows = await db
    .select({
      accountId: ledgerTransactionsTable.accountId,
      totalDebit: sql<string>`COALESCE(SUM(${ledgerTransactionsTable.debit}::numeric), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${ledgerTransactionsTable.credit}::numeric), 0)`,
    })
    .from(ledgerTransactionsTable)
    .where(and(...conditions))
    .groupBy(ledgerTransactionsTable.accountId);

  const accountIds = rows.map((r) => r.accountId);
  if (accountIds.length === 0) return res.json([]);

  const accounts = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.tenantId, tenantId), inArray(accountsTable.id, accountIds)));

  const acctMap = new Map(accounts.map((a) => [a.id, a]));

  const result = rows.map((r) => {
    const acct = acctMap.get(r.accountId);
    const debit = n(r.totalDebit);
    const credit = n(r.totalCredit);
    const openingBal = n(acct?.openingBalance ?? 0);
    return {
      accountId: r.accountId,
      code: acct?.code ?? "",
      name: acct?.name ?? "Unknown",
      type: acct?.type ?? "",
      group: acct?.group ?? null,
      debit: debit + Math.max(0, openingBal),
      credit: credit + Math.max(0, -openingBal),
      balance: openingBal + debit - credit,
    };
  }).filter((r) => r.debit > 0.001 || r.credit > 0.001 || Math.abs(r.balance) > 0.001)
    .sort((a, b) => a.code.localeCompare(b.code));

  return res.json(result);
});

router.get("/accounting/reports/profit-loss", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const today = new Date().toISOString().split("T")[0]!;
  const dateFrom = qs(req.query.dateFrom) || today.substring(0, 7) + "-01";
  const dateTo = qs(req.query.dateTo) || today;

  const rows = await db
    .select({
      accountId: ledgerTransactionsTable.accountId,
      totalDebit: sql<string>`COALESCE(SUM(${ledgerTransactionsTable.debit}::numeric), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${ledgerTransactionsTable.credit}::numeric), 0)`,
    })
    .from(ledgerTransactionsTable)
    .where(and(
      eq(ledgerTransactionsTable.tenantId, tenantId),
      gte(ledgerTransactionsTable.date, dateFrom),
      lte(ledgerTransactionsTable.date, dateTo),
    ))
    .groupBy(ledgerTransactionsTable.accountId);

  const accountIds = rows.map((r) => r.accountId);
  const accounts = accountIds.length > 0
    ? await db.select().from(accountsTable)
        .where(and(eq(accountsTable.tenantId, tenantId), inArray(accountsTable.id, accountIds)))
    : [];

  const acctMap = new Map(accounts.map((a) => [a.id, a]));

  const income: typeof result = [];
  const expenses: typeof result = [];

  const result = rows.map((r) => {
    const acct = acctMap.get(r.accountId);
    return {
      accountId: r.accountId,
      code: acct?.code ?? "",
      name: acct?.name ?? "Unknown",
      type: acct?.type ?? "",
      group: acct?.group ?? null,
      debit: n(r.totalDebit),
      credit: n(r.totalCredit),
      balance: n(r.totalCredit) - n(r.totalDebit), // income: credit > debit = positive
    };
  });

  for (const r of result) {
    if (r.type === "income") income.push(r);
    else if (r.type === "expense") expenses.push(r);
  }

  const totalIncome = income.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenses.reduce((s, r) => s + Math.abs(r.balance), 0);

  return res.json({
    income: income.sort((a, b) => a.code.localeCompare(b.code)),
    expenses: expenses.sort((a, b) => a.code.localeCompare(b.code)),
    totalIncome,
    totalExpenses,
    grossProfit: totalIncome,
    netProfit: totalIncome - totalExpenses,
    dateFrom,
    dateTo,
  });
});

router.get("/accounting/reports/cash-summary", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const today = new Date().toISOString().split("T")[0]!;
  const dateFrom = qs(req.query.dateFrom) || today;
  const dateTo = qs(req.query.dateTo) || today;
  const accountIdParam = req.query.accountId ? parseInt(qs(req.query.accountId)) : null;

  // Find cash account (code 1101 by default)
  let account = null;
  if (accountIdParam) {
    [account] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.id, accountIdParam), eq(accountsTable.tenantId, tenantId)));
  }
  if (!account) {
    [account] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.tenantId, tenantId), eq(accountsTable.code, "1101")));
  }

  if (!account) return res.status(404).json({ error: "Cash account not found. Please seed accounts first." });

  // Opening balance = all transactions before dateFrom
  const [openRow] = await db
    .select({ bal: sql<string>`COALESCE(SUM(${ledgerTransactionsTable.debit}::numeric - ${ledgerTransactionsTable.credit}::numeric), 0)` })
    .from(ledgerTransactionsTable)
    .where(and(
      eq(ledgerTransactionsTable.tenantId, tenantId),
      eq(ledgerTransactionsTable.accountId, account.id),
      lte(ledgerTransactionsTable.date, dateFrom),
    ));

  const openingBalance = n(account.openingBalance) + n(openRow?.bal ?? 0);

  const transactions = await db.select().from(ledgerTransactionsTable)
    .where(and(
      eq(ledgerTransactionsTable.tenantId, tenantId),
      eq(ledgerTransactionsTable.accountId, account.id),
      gte(ledgerTransactionsTable.date, dateFrom),
      lte(ledgerTransactionsTable.date, dateTo),
    ))
    .orderBy(asc(ledgerTransactionsTable.date), asc(ledgerTransactionsTable.id));

  const totalIn = transactions.reduce((s, t) => s + n(t.debit), 0);
  const totalOut = transactions.reduce((s, t) => s + n(t.credit), 0);

  let running = openingBalance;
  const rows = transactions.map((lt) => {
    running += n(lt.debit) - n(lt.credit);
    return { ...fmtLedger(lt), balance: running };
  });

  return res.json({
    account: fmtAccount(account),
    openingBalance,
    totalIn,
    totalOut,
    closingBalance: openingBalance + totalIn - totalOut,
    transactions: rows,
  });
});

router.get("/accounting/reports/gst-summary", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const today = new Date().toISOString().split("T")[0]!;
  const dateFrom = qs(req.query.dateFrom) || today.substring(0, 7) + "-01";
  const dateTo = qs(req.query.dateTo) || today;

  // Sales GST from sales table
  const [salesGst] = await db
    .select({
      total: sql<string>`COALESCE(SUM(tax_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(salesTable)
    .where(and(
      eq(salesTable.tenantId, tenantId),
      ne(salesTable.status, "voided"),
      gte(salesTable.createdAt, new Date(dateFrom + "T00:00:00Z")),
      lte(salesTable.createdAt, new Date(dateTo + "T23:59:59Z")),
    ));

  // Purchase GST from purchases table
  const [purchaseGst] = await db
    .select({
      total: sql<string>`COALESCE(SUM(tax_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(purchasesTable)
    .where(and(
      eq(purchasesTable.tenantId, tenantId),
      gte(purchasesTable.createdAt, new Date(dateFrom + "T00:00:00Z")),
      lte(purchasesTable.createdAt, new Date(dateTo + "T23:59:59Z")),
    ));

  const outputGst = n(salesGst?.total ?? 0);
  const inputGst = n(purchaseGst?.total ?? 0);

  return res.json({
    outputGst,
    inputGst,
    netPayable: outputGst - inputGst,
    salesCount: salesGst?.count ?? 0,
    purchaseCount: purchaseGst?.count ?? 0,
    dateFrom,
    dateTo,
  });
});

router.get("/accounting/reports/day-closing", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;
  const date = qs(req.query.date) || new Date().toISOString().split("T")[0]!;
  const dayStart = new Date(date + "T00:00:00Z");
  const dayEnd = new Date(date + "T23:59:59Z");

  const [salesRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(total::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(salesTable)
    .where(and(
      eq(salesTable.tenantId, tenantId),
      ne(salesTable.status, "voided"),
      gte(salesTable.createdAt, dayStart),
      lte(salesTable.createdAt, dayEnd),
    ));

  // Payment breakdown
  const paymentRows = await db
    .select({
      method: paymentsTable.method,
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
    })
    .from(paymentsTable)
    .innerJoin(salesTable, eq(salesTable.id, paymentsTable.saleId))
    .where(and(
      eq(paymentsTable.tenantId, tenantId),
      ne(salesTable.status, "voided"),
      gte(salesTable.createdAt, dayStart),
      lte(salesTable.createdAt, dayEnd),
    ))
    .groupBy(paymentsTable.method);

  const payMap: Record<string, number> = {};
  for (const r of paymentRows) payMap[r.method] = n(r.total);

  const [expRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.tenantId, tenantId),
      eq(expensesTable.status, "approved"),
      eq(expensesTable.date, date),
    ));

  const [purchRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(total::numeric), 0)` })
    .from(purchasesTable)
    .where(and(
      eq(purchasesTable.tenantId, tenantId),
      gte(purchasesTable.createdAt, dayStart),
      lte(purchasesTable.createdAt, dayEnd),
    ));

  return res.json({
    date,
    totalSales: n(salesRow?.total ?? 0),
    salesCount: salesRow?.count ?? 0,
    totalCashSales: payMap["cash"] ?? 0,
    totalCardSales: payMap["card"] ?? 0,
    totalUpiSales: payMap["upi"] ?? 0,
    totalExpenses: n(expRow?.total ?? 0),
    expensesCount: expRow?.count ?? 0,
    totalPurchases: n(purchRow?.total ?? 0),
    netCashIn: (payMap["cash"] ?? 0) - n(expRow?.total ?? 0),
    paymentBreakdown: payMap,
  });
});

// ─── OUTSTANDING ─────────────────────────────────────────────────────────────

router.get("/accounting/outstanding/customers", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;

  const rows = await db
    .select({
      customerId: salesTable.customerId,
      customerName: salesTable.customerName,
      totalInvoiced: sql<string>`COALESCE(SUM(total::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(paid_amount::numeric), 0)`,
    })
    .from(salesTable)
    .where(and(
      eq(salesTable.tenantId, tenantId),
      ne(salesTable.status, "voided"),
      ne(salesTable.paymentStatus, "paid"),
    ))
    .groupBy(salesTable.customerId, salesTable.customerName)
    .having(sql`SUM(total::numeric) - SUM(paid_amount::numeric) > 0`);

  return res.json(rows.map((r) => ({
    partyId: r.customerId ?? 0,
    partyName: r.customerName ?? "Walk-in",
    partyType: "customer",
    totalInvoiced: n(r.totalInvoiced),
    totalPaid: n(r.totalPaid),
    balance: n(r.totalInvoiced) - n(r.totalPaid),
    oldestDue: null,
  })));
});

router.get("/accounting/outstanding/suppliers", requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId;

  const rows = await db
    .select({
      supplierId: purchasesTable.supplierId,
      total: sql<string>`COALESCE(SUM(total::numeric), 0)`,
      paid: sql<string>`COALESCE(SUM(paid_amount::numeric), 0)`,
    })
    .from(purchasesTable)
    .where(and(
      eq(purchasesTable.tenantId, tenantId),
      ne(purchasesTable.paymentStatus, "paid"),
    ))
    .groupBy(purchasesTable.supplierId)
    .having(sql`SUM(total::numeric) - SUM(paid_amount::numeric) > 0`);

  if (rows.length === 0) return res.json([]);

  const supplierIds = rows.map((r) => r.supplierId).filter((id): id is number => id !== null);
  const suppliers = supplierIds.length > 0
    ? await db.select().from(suppliersTable)
        .where(and(eq(suppliersTable.tenantId, tenantId), inArray(suppliersTable.id, supplierIds)))
    : [];
  const supMap = new Map(suppliers.map((s) => [s.id, s]));

  return res.json(rows.map((r) => ({
    partyId: r.supplierId ?? 0,
    partyName: supMap.get(r.supplierId ?? 0)?.name ?? "Unknown Supplier",
    partyType: "supplier",
    totalInvoiced: n(r.total),
    totalPaid: n(r.paid),
    balance: n(r.total) - n(r.paid),
    oldestDue: null,
  })));
});

export default router;
