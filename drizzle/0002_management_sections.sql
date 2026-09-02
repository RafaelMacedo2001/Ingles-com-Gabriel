ALTER TABLE `students` ADD COLUMN `renewal_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `lesson_metadata` (
	`file_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`level` text DEFAULT 'Todos os níveis' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communications` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communications_created_at` ON `communications` (`created_at`);
