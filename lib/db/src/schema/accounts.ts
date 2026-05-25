import { pgTable, serial, integer, text, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export type AccountType = "asset" | "liability" | "income" | "expense" | "capital";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),                           // e.g. "1000", "1100"
  name: text("name").notNull(),
  type: text("type").notNull(),                           // asset | liability | income | expense | capital
  group: text("group"),                                   // sub-group label e.g. "Current Assets"
  parentId: integer("parent_id"),                         // self-reference for hierarchy (set in app, not DB FK to avoid circular)
  isGroup: boolean("is_group").notNull().default(false),  // true = group/header account, no direct postings
  isSystem: boolean("is_system").notNull().default(false),// system accounts cannot be deleted
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  openingBalanceDate: text("opening_balance_date"),       // ISO date string
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("accounts_tenant_idx").on(t.tenantId),
  index("accounts_code_tenant_idx").on(t.tenantId, t.code),
  index("accounts_type_idx").on(t.type),
]);

export type Account = typeof accountsTable.$inferSelect;
