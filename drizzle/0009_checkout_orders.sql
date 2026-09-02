CREATE TABLE IF NOT EXISTS `checkout_orders` (
  `id` text PRIMARY KEY NOT NULL,
  `preference_id` text,
  `payment_id` text,
  `status` text NOT NULL DEFAULT 'created',
  `name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `amount` real NOT NULL,
  `currency` text NOT NULL DEFAULT 'BRL',
  `checkout_url` text,
  `student_id` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_checkout_orders_status` ON `checkout_orders` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_checkout_orders_payment_id` ON `checkout_orders` (`payment_id`);
