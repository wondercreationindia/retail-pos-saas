import { pgTable, serial, integer, text, boolean, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { categoriesTable } from "./categories";
import { usersTable } from "./users";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),

  // Core product info
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  barcode: text("barcode"),
  hsnCode: text("hsn_code"),
  brand: text("brand"),
  unit: text("unit").default("pcs"),
  weight: numeric("weight", { precision: 10, scale: 3 }),
  size: text("size"),
  color: text("color"),

  // Pricing
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }),
  mrp: numeric("mrp", { precision: 10, scale: 2 }),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("0"),

  // Inventory
  stock: integer("stock").notNull().default(0),
  minStockAlert: integer("min_stock_alert").default(10),
  maxStock: integer("max_stock"),
  trackInventory: boolean("track_inventory").notNull().default(true),
  allowNegativeStock: boolean("allow_negative_stock").notNull().default(false),

  // Category & image
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),

  // E-commerce / online store
  slug: text("slug"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  publishOnline: boolean("publish_online").notNull().default(false),
  featuredProduct: boolean("featured_product").notNull().default(false),

  // Barcode printing
  barcodeType: text("barcode_type").default("CODE128"),
  labelWidth: numeric("label_width", { precision: 5, scale: 2 }),
  labelHeight: numeric("label_height", { precision: 5, scale: 2 }),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("active"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Relationships
  supplierId: integer("supplier_id"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (table) => [
  index("products_tenant_idx").on(table.tenantId),
  index("products_barcode_idx").on(table.barcode),
  index("products_sku_idx").on(table.sku),
  index("products_slug_idx").on(table.slug),
  index("products_name_idx").on(table.name),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
