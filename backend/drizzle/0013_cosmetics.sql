CREATE TABLE `user_cosmetics` (
	`user_id` text NOT NULL,
	`estilo` text NOT NULL,
	`monedas` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `estilo`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_cosmetics_estilo_idx` ON `user_cosmetics` (`estilo`);