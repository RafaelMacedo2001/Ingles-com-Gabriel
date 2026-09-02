CREATE TABLE IF NOT EXISTS `lesson_progress` (
  `student_id` text NOT NULL,
  `lesson_id` text NOT NULL,
  `lesson_title` text NOT NULL,
  `watched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_lesson_progress_student_lesson` ON `lesson_progress` (`student_id`, `lesson_id`);
