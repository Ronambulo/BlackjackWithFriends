CREATE TABLE `adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`motivo` text NOT NULL,
	`por` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `adjustments_user_idx` ON `adjustments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`texto` text NOT NULL,
	`ruta` text,
	`dispositivo` text,
	`resuelto` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_created_idx` ON `reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `reports_user_idx` ON `reports` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `usuario_cambiado` integer;