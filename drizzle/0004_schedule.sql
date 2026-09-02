CREATE TABLE IF NOT EXISTS `schedule_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `weekday` integer NOT NULL CHECK(`weekday` BETWEEN 1 AND 7),
  `start_time` text NOT NULL,
  `title` text NOT NULL,
  `details` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_schedule_weekday_time` ON `schedule_entries` (`weekday`, `start_time`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `app_meta` (
  `meta_key` text PRIMARY KEY NOT NULL,
  `meta_value` text NOT NULL
);
