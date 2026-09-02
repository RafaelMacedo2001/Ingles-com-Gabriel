CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_access_at` text
);
--> statement-breakpoint
CREATE TABLE `expiration_notices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`notice_type` text NOT NULL,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_students_email` ON `students` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_students_expires_at` ON `students` (`expires_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notices_student_type` ON `expiration_notices` (`student_id`,`notice_type`);
