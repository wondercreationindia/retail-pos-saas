import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const reportExportLogsTable = pgTable("report_export_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reportType: text("report_type").notNull(),
  exportFormat: text("export_format").notNull(),
  filters: jsonb("filters").default({}),
  rowCount: integer("row_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportTemplatesTable = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(),
  filters: jsonb("filters").notNull().default({}),
  isDefault: text("is_default").default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReportExportLogSchema = createInsertSchema(reportExportLogsTable).omit({ id: true, createdAt: true });
export const insertReportTemplateSchema = createInsertSchema(reportTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ReportExportLog = typeof reportExportLogsTable.$inferSelect;
export type ReportTemplate = typeof reportTemplatesTable.$inferSelect;
