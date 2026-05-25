import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { salesTable } from "./sales";
import { usersTable } from "./users";

export const whatsappInvoiceLogsTable = pgTable("whatsapp_invoice_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  sentBy: integer("sent_by").references(() => usersTable.id, { onDelete: "set null" }),
  phone: text("phone").notNull(),
  status: text("status").notNull().default("sent"), // sent | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WhatsappInvoiceLog = typeof whatsappInvoiceLogsTable.$inferSelect;
