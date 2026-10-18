CREATE TABLE `admin_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo` text NOT NULL,
	`titulo` text NOT NULL,
	`inicio` integer NOT NULL,
	`fin` integer,
	`valor` integer,
	`detalle` text,
	`por` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_events_inicio_idx` ON `admin_events` (`inicio`);--> statement-breakpoint
CREATE TABLE `admin_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`admin` text NOT NULL,
	`texto` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_notes_user_idx` ON `admin_notes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `player_marks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`etiquetas` text DEFAULT '[]' NOT NULL,
	`hermanas` text DEFAULT '[]' NOT NULL,
	`silenciado_hasta` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `price_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`estilo` text NOT NULL,
	`precio_b` integer NOT NULL,
	`inicio` integer NOT NULL,
	`fin` integer,
	`por` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `admin_log` ADD `deshacer` text;--> statement-breakpoint
ALTER TABLE `admin_log` ADD `deshecho` integer DEFAULT false NOT NULL;