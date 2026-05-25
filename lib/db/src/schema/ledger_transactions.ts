import { pgTable, serial, integer, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { accountsTable } from "./accounts";
import { journalEntriesTable } from "./journal_entries";

// Ledger transactions: one row per journal_item, with running balance per account.
// Rebuilt from journal_items but kept denormalized for fast ledger queries.
export const ledgerTransactionsTable = pgTable("ledger_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  journalEntryId: integer("journal_entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  description: text("description").notNull(),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  // Running balance is computed on-the-fly in queries for accuracy; stored for fast pagination
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  referenceNumber: text("reference_number"),
  partyType: text("party_type"),
  partyId: integer("party_id"),
  partyName: text("party_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("lt_account_date_idx").on(t.accountId, t.date),
  index("lt_tenant_idx").on(t.tenantId),
  index("lt_account_idx").on(t.accountId),
  index("lt_date_idx").on(t.date),
  index("lt_ref_idx").on(t.referenceType, t.referenceId),
  index("lt_party_idx").on(t.partyType, t.partyId),
]);

export type LedgerTransaction = typeof ledgerTransactionsTable.$inferSelect;
