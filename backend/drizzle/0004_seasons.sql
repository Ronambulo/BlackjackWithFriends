CREATE TABLE `season_results` (
	`semana` text NOT NULL,
	`user_id` text NOT NULL,
	`saldo_final` integer NOT NULL,
	`estadisticas` text NOT NULL,
	`monedas` integer NOT NULL,
	`mejor_puesto` integer,
	`vista` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`semana`, `user_id`),
	FOREIGN KEY (`semana`) REFERENCES `seasons`(`semana`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `season_results_user_id_idx` ON `season_results` (`user_id`);--> statement-breakpoint
CREATE TABLE `season_standings` (
	`semana` text NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`posicion` integer NOT NULL,
	`saldo_final` integer NOT NULL,
	`con_premios` integer NOT NULL,
	`trofeo` integer DEFAULT false NOT NULL,
	`premios` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`semana`, `group_id`, `user_id`),
	FOREIGN KEY (`semana`) REFERENCES `seasons`(`semana`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `season_standings_group_idx` ON `season_standings` (`group_id`,`semana`);--> statement-breakpoint
CREATE INDEX `season_standings_user_idx` ON `season_standings` (`user_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`semana` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
