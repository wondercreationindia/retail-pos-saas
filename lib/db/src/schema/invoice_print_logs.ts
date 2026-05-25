import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { salesTable } from "./sales";
import { usersTable } from "./users";

export const invoicePrintLogsTable = pgTable("invoice_print_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  printedBy: integer("printed_by").references(() => usersTable.id, { onDelete: "set null" }),
  printType: text("print_type").notNull().default("thermal"), // thermal | a4 | gst
  isDuplicate: integer("is_duplicate").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InvoicePrintLog = typeof invoicePrintLogsTable.$inferSelect;
