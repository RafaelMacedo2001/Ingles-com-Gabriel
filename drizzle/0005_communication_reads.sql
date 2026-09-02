CREATE TABLE IF NOT EXISTS `communication_reads` (
  `student_id` text NOT NULL,
  `communication_id` text NOT NULL,
  `read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_communication_reads_student_message` ON `communication_reads` (`student_id`, `communication_id`);
