import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),

  adjustmentType: text("adjustment_type").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  beforeQuantity: numeric("before_quantity", { precision: 10, scale: 3 }).notNull(),
  afterQuantity: numeric("after_quantity", { precision: 10, scale: 3 }).notNull(),

  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  reason: text("reason"),
  notes: text("notes"),
  referenceNumber: text("reference_number"),

  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("adj_tenant_idx").on(table.tenantId),
  index("adj_product_idx").on(table.productId),
  index("adj_type_idx").on(table.adjustmentType),
]);

export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustmentsTable).omit({ id: true, createdAt: true });
export type InsertStockAdjustment = z.infer<typeof insertStockAdjustmentSchema>;
export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;
