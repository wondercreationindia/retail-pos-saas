import { pgTable, serial, integer, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";

// payment | receipt | journal | contra
export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  voucherNumber: text("voucher_number").notNull(),
  type: text("type").notNull(),             // payment | receipt | journal | contra
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }), // cash/bank account used
  contraAccountId: integer("contra_account_id").references(() => accountsTable.id, { onDelete: "set null" }), // the other side
  partyType: text("party_type"),            // customer | supplier | null
  partyId: integer("party_id"),
  partyName: text("party_name"),
  description: text("description").notNull(),
  reference: text("reference"),             // cheque number, transaction ID, etc.
  status: text("status").notNull().default("posted"), // draft | posted | cancelled
  journalEntryId: integer("journal_entry_id"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("vouchers_tenant_idx").on(t.tenantId),
  index("vouchers_type_idx").on(t.type),
  index("vouchers_date_idx").on(t.date),
  index("vouchers_party_idx").on(t.partyType, t.partyId),
]);

export type Voucher = typeof vouchersTable.$inferSelect;
