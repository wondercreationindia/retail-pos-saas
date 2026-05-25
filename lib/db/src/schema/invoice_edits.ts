import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { salesTable } from "./sales";
import { usersTable } from "./users";

export const invoiceEditsTable = pgTable("invoice_edits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  editedBy: integer("edited_by").references(() => usersTable.id, { onDelete: "set null" }),
  reason: text("reason").notNull().default(""),
  beforeSnapshot: jsonb("before_snapshot").notNull().default({}),
  afterSnapshot: jsonb("after_snapshot").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InvoiceEdit = typeof invoiceEditsTable.$inferSelect;
