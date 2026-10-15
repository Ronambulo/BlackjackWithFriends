CREATE TABLE `achievements` (
	`user_id` text NOT NULL,
	`logro` text NOT NULL,
	`visto` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `logro`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
