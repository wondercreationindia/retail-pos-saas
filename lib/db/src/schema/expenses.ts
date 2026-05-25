import { pgTable, serial, integer, text, numeric, boolean, timestamp, date, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  expenseNumber: text("expense_number").notNull(),
  date: date("date").notNull(),
  category: text("category").notNull(),            // Rent | Utilities | Salaries | Marketing | Other…
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  vendor: text("vendor"),
  description: text("description").notNull(),
  paymentMethod: text("payment_method").default("cash"), // cash | bank | credit
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }), // expense GL account
  paidFromAccountId: integer("paid_from_account_id").references(() => accountsTable.id, { onDelete: "set null" }), // cash/bank
  status: text("status").notNull().default("pending"),   // pending | approved | rejected | paid
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  journalEntryId: integer("journal_entry_id"),
  attachmentUrl: text("attachment_url"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrencePeriod: text("recurrence_period"),    // monthly | weekly | yearly
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("expenses_tenant_idx").on(t.tenantId),
  index("expenses_date_idx").on(t.date),
  index("expenses_category_idx").on(t.category),
  index("expenses_status_idx").on(t.status),
]);

export type Expense = typeof expensesTable.$inferSelect;
