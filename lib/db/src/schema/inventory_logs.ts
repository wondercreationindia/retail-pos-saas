import { pgTable, serial, integer, text, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const inventoryLogsTable = pgTable("inventory_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),

  type: text("type").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  beforeQuantity: numeric("before_quantity", { precision: 10, scale: 3 }).notNull(),
  afterQuantity: numeric("after_quantity", { precision: 10, scale: 3 }).notNull(),

  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  batchNumber: text("batch_number"),
  expiryDate: date("expiry_date"),

  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),

  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("inv_logs_tenant_idx").on(table.tenantId),
  index("inv_logs_product_idx").on(table.productId),
  index("inv_logs_type_idx").on(table.type),
  index("inv_logs_created_idx").on(table.createdAt),
]);

export const insertInventoryLogSchema = createInsertSchema(inventoryLogsTable).omit({ id: true, createdAt: true });
export type InsertInventoryLog = z.infer<typeof insertInventoryLogSchema>;
export type InventoryLog = typeof inventoryLogsTable.$inferSelect;
