import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  code: text("code"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  country: text("country").default("India"),

  gstNumber: text("gst_number"),
  panNumber: text("pan_number"),

  paymentTerms: integer("payment_terms").default(30),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }).default("0"),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).default("0"),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).default("0"),

  notes: text("notes"),
  status: text("status").notNull().default("active"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("suppliers_tenant_idx").on(table.tenantId),
  index("suppliers_code_idx").on(table.code),
]);

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
