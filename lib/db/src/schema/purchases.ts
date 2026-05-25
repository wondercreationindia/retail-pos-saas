import { pgTable, serial, integer, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { suppliersTable } from "./suppliers";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),

  purchaseNumber: text("purchase_number").notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceDate: date("invoice_date"),
  dueDate: date("due_date"),

  status: text("status").notNull().default("draft"),

  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),

  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentMethod: text("payment_method"),

  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("purchases_tenant_idx").on(table.tenantId),
  index("purchases_supplier_idx").on(table.supplierId),
  index("purchases_number_idx").on(table.purchaseNumber),
  index("purchases_status_idx").on(table.status),
]);

export const purchaseItemsTable = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  purchaseId: integer("purchase_id").notNull().references(() => purchasesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),

  productName: text("product_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  receivedQuantity: numeric("received_quantity", { precision: 10, scale: 3 }).notNull().default("0"),

  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  mrp: numeric("mrp", { precision: 10, scale: 2 }),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),

  batchNumber: text("batch_number"),
  expiryDate: date("expiry_date"),
}, (table) => [
  index("purchase_items_purchase_idx").on(table.purchaseId),
  index("purchase_items_tenant_idx").on(table.tenantId),
]);

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseItemSchema = createInsertSchema(purchaseItemsTable).omit({ id: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type InsertPurchaseItem = z.infer<typeof insertPurchaseItemSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;
export type PurchaseItem = typeof purchaseItemsTable.$inferSelect;
