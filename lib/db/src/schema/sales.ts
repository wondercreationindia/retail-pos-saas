import { pgTable, serial, integer, text, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { customersTable } from "./customers";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  saleNumber: text("sale_number").notNull(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name"),
  cashierId: integer("cashier_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("completed"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  changeAmount: numeric("change_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("paid"),
  notes: text("notes"),
  loyaltyPointsEarned: integer("loyalty_points_earned").notNull().default(0),
  loyaltyPointsRedeemed: integer("loyalty_points_redeemed").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const saleItemsTable = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  mrp: numeric("mrp", { precision: 10, scale: 2 }),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const heldBillsTable = pgTable("held_bills", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  cashierId: integer("cashier_id").references(() => usersTable.id, { onDelete: "set null" }),
  label: text("label"),
  cartData: jsonb("cart_data").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export const insertHeldBillSchema = createInsertSchema(heldBillsTable).omit({ id: true, createdAt: true });

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertHeldBill = z.infer<typeof insertHeldBillSchema>;
export type Sale = typeof salesTable.$inferSelect;
export type SaleItem = typeof saleItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type HeldBill = typeof heldBillsTable.$inferSelect;
