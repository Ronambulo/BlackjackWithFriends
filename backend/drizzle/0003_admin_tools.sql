CREATE TABLE `admin_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin` text NOT NULL,
	`accion` text NOT NULL,
	`objetivo` text,
	`detalle` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_log_created_at_idx` ON `admin_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `economy_rules` (
	`semana` text PRIMARY KEY NOT NULL,
	`saldo_inicial` integer NOT NULL,
	`paga_diaria` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "economy_rules_saldo" CHECK("economy_rules"."saldo_inicial" between 1 and 1000000),
	CONSTRAINT "economy_rules_paga" CHECK("economy_rules"."paga_diaria" between 0 and 1000000)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`user_id` text NOT NULL,
	`tipo` text NOT NULL,
	`valor` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `tipo`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reviews_tipo" CHECK("reviews"."tipo" in ('foto', 'nombre'))
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`clave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ip_bans` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `ip_bans` ADD `por` text;