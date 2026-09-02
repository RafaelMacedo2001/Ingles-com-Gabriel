CREATE TABLE IF NOT EXISTS `lesson_materials` (
  `id` text PRIMARY KEY NOT NULL,
  `lesson_id` text NOT NULL,
  `lesson_title` text NOT NULL,
  `title` text NOT NULL,
  `file_name` text NOT NULL,
  `object_key` text NOT NULL UNIQUE,
  `content_type` text NOT NULL,
  `size` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_lesson_materials_lesson` ON `lesson_materials` (`lesson_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_lesson_materials_object_key` ON `lesson_materials` (`object_key`);
