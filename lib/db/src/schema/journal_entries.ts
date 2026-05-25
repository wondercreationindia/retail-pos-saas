import { pgTable, serial, integer, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  entryNumber: text("entry_number").notNull(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  referenceType: text("reference_type"),       // sale | purchase | expense | payment | receipt | contra | manual
  referenceId: integer("reference_id"),        // FK to the source record
  referenceNumber: text("reference_number"),   // human-readable ref e.g. "SALE-000012"
  status: text("status").notNull().default("posted"), // draft | posted | voided
  totalDebit: numeric("total_debit", { precision: 14, scale: 2 }).notNull().default("0"),
  totalCredit: numeric("total_credit", { precision: 14, scale: 2 }).notNull().default("0"),
  narration: text("narration"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("je_tenant_idx").on(t.tenantId),
  index("je_date_idx").on(t.date),
  index("je_ref_idx").on(t.referenceType, t.referenceId),
  index("je_status_idx").on(t.status),
]);

export const journalItemsTable = pgTable("journal_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  entryId: integer("entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "restrict" }),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  description: text("description"),
  partyType: text("party_type"),    // customer | supplier | null
  partyId: integer("party_id"),
  partyName: text("party_name"),
}, (t) => [
  index("ji_entry_idx").on(t.entryId),
  index("ji_account_idx").on(t.accountId),
  index("ji_tenant_idx").on(t.tenantId),
]);

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalItem = typeof journalItemsTable.$inferSelect;
