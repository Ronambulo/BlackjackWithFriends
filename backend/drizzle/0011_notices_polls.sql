CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plataforma` text NOT NULL,
	`pwa` integer NOT NULL,
	`push` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `devices_user_idx` ON `devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `devices_last_seen_idx` ON `devices` (`last_seen`);--> statement-breakpoint
CREATE TABLE `notice_views` (
	`notice_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`cerrado` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`notice_id`, `user_id`),
	FOREIGN KEY (`notice_id`) REFERENCES `notices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`texto` text NOT NULL,
	`audiencia` text DEFAULT 'all' NOT NULL,
	`starts_at` integer NOT NULL,
	`expires_at` integer,
	`por` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`poll_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`opcion` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `user_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pregunta` text NOT NULL,
	`opciones` text NOT NULL,
	`ends_at` integer,
	`por` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titulo` text NOT NULL,
	`cuerpo` text NOT NULL,
	`url` text DEFAULT '/' NOT NULL,
	`audiencia` text DEFAULT 'all' NOT NULL,
	`send_at` integer NOT NULL,
	`sent_at` integer,
	`dispositivos` integer DEFAULT 0 NOT NULL,
	`fallidos` integer DEFAULT 0 NOT NULL,
	`por` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_campaigns_pending_idx` ON `push_campaigns` (`sent_at`,`send_at`);--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `plataforma` text;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `pwa` integer;--> statement-breakpoint
-- The notice from before, kept in settings, becomes the first in the table.
INSERT INTO `notices` (`texto`, `audiencia`, `starts_at`, `expires_at`, `por`, `created_at`)
SELECT json_extract(`valor`, '$.text'), 'all', json_extract(`valor`, '$.createdAt'), json_extract(`valor`, '$.expiresAt'), json_extract(`valor`, '$.by'), json_extract(`valor`, '$.createdAt')
FROM `settings` WHERE `clave` = 'announcement';
