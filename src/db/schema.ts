// ⚠️ توجه: لایه‌ی واقعی سینک (`src/lib/db-layer.ts`) الان از PostgreSQL/Neon
// با مدل document-store (جدول `sync_docs` + JSONB) استفاده می‌کنه — نه از این
// اسکیمای ستونی. این فایل و drizzle.config.ts برای گزارش‌گیری/داشبورد آینده
// یا مهاجرت ستون‌به‌ستون نگه‌داری شده‌اند؛ برای سینک اپ نیازی به
// `drizzle-kit push` روی این schema نیست. جدول‌های عملیاتی موقع استارت سرور
// توسط db-layer به‌صورت خودکار ساخته می‌شوند.
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, boolean, jsonb, bigint } from "drizzle-orm/pg-core";

// Define the 'users' table.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define the 'products' table.
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code"),
  group: text("group"),
  name: text("name"),
  dims: text("dims"),
  dimW: text("dim_w"), // storing as text/numeric/jsonb, let's keep text or doublePrecision. Some client values could be strings or decimals, let's use text to avoid parsing issues or text representation
  dimH: text("dim_h"),
  shape: text("shape"),
  images: jsonb("images"), // array of image filenames
  image: text("image"), // main image filename or url
  lineItems: jsonb("line_items"), // array of line items
  salePrice: text("sale_price"), // numeric price, can be large or strings
  profitPct: text("profit_pct"),
  status: text("status"),
  location: text("location"),
  settled: boolean("settled").default(false),
  buyerName: text("buyer_name"),
  buyerCustomerId: text("buyer_customer_id"),
  buyerPhone: text("buyer_phone"),
  saleDate: text("sale_date"),
  settleDate: text("settle_date"),
  discountPercent: text("discount_percent"),
  discountedPrice: text("discounted_price"),
  createdAt: text("created_at"),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
  galleryOwnerName: text("gallery_owner_name"),
  productTypeId: text("product_type_id"),
  qty: text("qty"), // تعداد محصولات ست (پیش‌فرض ۱) — برای محاسبه‌ی مساحت مصرفی مضرب qty
});

// Define the 'product_types' table — reusable, named product categories
// (separate from the fabric-based "group" field) that users can add/edit/delete.
export const productTypes = pgTable("product_types", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
});

// Define the 'photos' table for tracking file synchronization
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(), // Links to products
  fileName: text("file_name").notNull(),
  fileHash: text("file_hash"), // To detect changes
  createdAt: text("created_at"),
});

// Define the 'material_changes' table for tracking changes to materials.
export const materialChanges = pgTable("material_changes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  materialId: text("material_id").notNull(),
  action: text("action").notNull(), // 'lock' or 'free'
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

// Define the 'materials' table.
export const materials = pgTable("materials", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  type: text("type"),
  category: text("category"),
  totalCost: text("total_cost"),
  remainingCost: text("remaining_cost"),
  procurements: jsonb("procurements"),
  batches: jsonb("batches"),
  sticks: jsonb("sticks"),
  isHardwareTool: boolean("is_hardware_tool").default(false),
  includeInCost: boolean("include_in_cost").default(true),
  hidden: boolean("hidden").default(false),
  purchaseDate: text("purchase_date"),
  dimW: text("dim_w"),
  dimH: text("dim_h"),
  unitLength: text("unit_length"),
  ratioValue: text("ratio_value"),
  fixedQty: text("fixed_qty"),
  defaultPct: text("default_pct"),
  totalMaterial: text("total_material"),
  usedMaterial: text("used_material"),
  remainingMaterial: text("remaining_material"),
  isWaste: boolean("is_waste").default(false),
  isUsableRemaining: boolean("is_usable_remaining").default(true),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
});

// Define the 'customers' table.
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  phone: text("phone"),
  kind: text("kind"),
  color: text("color"),
  note: text("note"),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
});

// Define the 'equipment' table.
export const equipment = pgTable("equipment", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  type: text("type"),
  purchasePrice: text("purchase_price"),
  purchaseDate: text("purchase_date"),
  depreciationYears: text("depreciation_years"),
  salvageValue: text("salvage_value"),
  maintenanceCost: text("maintenance_cost"),
  lastMaintenanceDate: text("last_maintenance_date"),
  note: text("note"),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
});

// Define the 'workshop_links' table.
export const workshopLinks = pgTable("workshop_links", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  productId: text("product_id"),
  materialId: text("material_id"),
  frameId: text("frame_id"),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
});

// Define the 'business_cards' table.
export const businessCards = pgTable("business_cards", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  telegram: text("telegram"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  note: text("note"),
  isMine: boolean("is_mine").default(false),
  updatedAt: bigint("updated_at", { mode: "number" }), // JS timestamp
});

// Define the 'invoices' table.
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  customerId: text("customer_id"), // Optional
  date: text("date"),
  total: text("total"),
  discount: text("discount"),
  finalTotal: text("final_total"),
  settled: boolean("settled").default(false),
  settleDate: text("settle_date"),
  type: text("type"), // 'invoice' or 'receipt'
  updatedAt: bigint("updated_at", { mode: "number" }),
});

// Define the 'invoice_items' table.
export const invoiceItems = pgTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  productId: text("product_id").notNull(),
  price: text("price"),
  discount: text("discount"),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  materials: many(materials),
  customers: many(customers),
  equipment: many(equipment),
  workshopLinks: many(workshopLinks),
  businessCards: many(businessCards),
  invoices: many(invoices),
}));

export const productsRelations = relations(products, ({ one }) => ({
  user: one(users, {
    fields: [products.userId],
    references: [users.id],
  }),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
  user: one(users, {
    fields: [materials.userId],
    references: [users.id],
  }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  user: one(users, {
    fields: [equipment.userId],
    references: [users.id],
  }),
}));

export const workshopLinksRelations = relations(workshopLinks, ({ one }) => ({
  user: one(users, {
    fields: [workshopLinks.userId],
    references: [users.id],
  }),
}));

export const businessCardsRelations = relations(businessCards, ({ one }) => ({
  user: one(users, {
    fields: [businessCards.userId],
    references: [users.id],
  }),
}));
