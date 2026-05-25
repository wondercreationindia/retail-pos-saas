import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const cashierSessionsTable = pgTable("cashier_sessions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  cashierId: integer("cashier_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  openingCash: numeric("opening_cash", { precision: 10, scale: 2 }).notNull().default("0"),
  closingCash: numeric("closing_cash", { precision: 10, scale: 2 }),
  expectedCash: numeric("expected_cash", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("open"), // open | closed
  notes: text("notes"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertCashierSessionSchema = createInsertSchema(cashierSessionsTable).omit({ id: true, openedAt: true });
export type InsertCashierSession = z.infer<typeof insertCashierSessionSchema>;
export type CashierSession = typeof cashierSessionsTable.$inferSelect;
