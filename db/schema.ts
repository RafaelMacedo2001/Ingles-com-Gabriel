import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash"),
  expiresAt: text("expires_at").notNull(),
  renewalCount: integer("renewal_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastAccessAt: text("last_access_at"),
}, (table) => [
  uniqueIndex("idx_students_email").on(table.email),
  index("idx_students_expires_at").on(table.expiresAt),
]);

export const expirationNotices = sqliteTable("expiration_notices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  noticeType: text("notice_type").notNull(),
  sentAt: text("sent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_notices_student_type").on(table.studentId, table.noticeType)]);

export const accessEvents = sqliteTable("access_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  accessedAt: text("accessed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_access_events_accessed_at").on(table.accessedAt)]);

export const lessonMetadata = sqliteTable("lesson_metadata", {
  fileId: text("file_id").primaryKey(),
  title: text("title").notNull(),
  level: text("level").notNull().default("Todos os níveis"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const lessonProgress = sqliteTable("lesson_progress", {
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  lessonTitle: text("lesson_title").notNull(),
  watchedAt: text("watched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_lesson_progress_student_lesson").on(table.studentId, table.lessonId)]);

export const lessonMaterials = sqliteTable("lesson_materials", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id").notNull(),
  lessonTitle: text("lesson_title").notNull(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_lesson_materials_lesson").on(table.lessonId),
  uniqueIndex("idx_lesson_materials_object_key").on(table.objectKey),
]);

export const communications = sqliteTable("communications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_communications_created_at").on(table.createdAt)]);

export const communicationReads = sqliteTable("communication_reads", {
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  communicationId: text("communication_id").notNull().references(() => communications.id, { onDelete: "cascade" }),
  readAt: text("read_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_communication_reads_student_message").on(table.studentId, table.communicationId)]);

export const serviceSettings = sqliteTable("service_settings", {
  settingKey: text("setting_key").primaryKey(),
  encryptedValue: text("encrypted_value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const checkoutOrders = sqliteTable("checkout_orders", {
  id: text("id").primaryKey(),
  preferenceId: text("preference_id"),
  paymentId: text("payment_id"),
  status: text("status").notNull().default("created"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("BRL"),
  checkoutUrl: text("checkout_url"),
  studentId: text("student_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_checkout_orders_status").on(table.status),
  index("idx_checkout_orders_payment_id").on(table.paymentId),
]);

export const scheduleEntries = sqliteTable("schedule_entries", {
  id: text("id").primaryKey(),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_schedule_weekday_time").on(table.weekday, table.startTime)]);

export const appMeta = sqliteTable("app_meta", {
  metaKey: text("meta_key").primaryKey(),
  metaValue: text("meta_value").notNull(),
});
