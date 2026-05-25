import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const stockTransfersTable = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),

  transferNumber: text("transfer_number").notNull(),
  fromLocation: text("from_location").notNull().default("main"),
  toLocation: text("to_location").notNull(),

  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  beforeQuantity: numeric("before_quantity", { precision: 10, scale: 3 }).notNull(),
  afterQuantity: numeric("after_quantity", { precision: 10, scale: 3 }).notNull(),

  status: text("status").notNull().default("completed"),
  notes: text("notes"),

  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("transfers_tenant_idx").on(table.tenantId),
  index("transfers_product_idx").on(table.productId),
  index("transfers_number_idx").on(table.transferNumber),
]);

export const insertStockTransferSchema = createInsertSchema(stockTransfersTable).omit({ id: true, createdAt: true });
export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;
export type StockTransfer = typeof stockTransfersTable.$inferSelect;
