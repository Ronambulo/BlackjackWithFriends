CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rol` text DEFAULT 'miembro' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "group_members_rol" CHECK("group_members"."rol" in ('admin', 'miembro'))
);
--> statement-breakpoint
CREATE INDEX `group_members_user_id_idx` ON `group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`codigo_invitacion` text NOT NULL,
	`ajustes` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "groups_nombre_len" CHECK(length(trim("groups"."nombre")) between 2 and 30)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_codigo_invitacion_unique` ON `groups` (`codigo_invitacion`);--> statement-breakpoint
CREATE TABLE `hands` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`modo` text NOT NULL,
	`apuesta` integer NOT NULL,
	`ronda` text NOT NULL,
	`fase` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`neto` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hands_apuesta" CHECK("hands"."apuesta" > 0)
);
--> statement-breakpoint
CREATE INDEX `hands_user_id_idx` ON `hands` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `hands_one_open_idx` ON `hands` (`user_id`,`modo`) WHERE "hands"."fase" <> 'settled';--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text,
	`avatar_url` text,
	`idioma` text DEFAULT 'es' NOT NULL,
	`monedas` integer DEFAULT 0 NOT NULL,
	`estilos_equipados` text DEFAULT '{}' NOT NULL,
	`saldo` integer DEFAULT 1000 NOT NULL,
	`semana` text NOT NULL,
	`ultima_paga` text,
	`saldo_inicio_dia` integer DEFAULT 1000 NOT NULL,
	`dia` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_nombre_len" CHECK("profiles"."nombre" is null or length(trim("profiles"."nombre")) between 2 and 20),
	CONSTRAINT "profiles_idioma" CHECK("profiles"."idioma" in ('es', 'en')),
	CONSTRAINT "profiles_monedas" CHECK("profiles"."monedas" >= 0),
	CONSTRAINT "profiles_saldo" CHECK("profiles"."saldo" >= 0)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_unique` ON `rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`username` text,
	`display_username` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);