CREATE TABLE `daily_decks` (
	`dia` text PRIMARY KEY NOT NULL,
	`semilla` text NOT NULL,
	`premiada` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_runs` (
	`user_id` text NOT NULL,
	`dia` text NOT NULL,
	`fichas` integer NOT NULL,
	`resultados` text DEFAULT '' NOT NULL,
	`ronda` text,
	`version` integer DEFAULT 0 NOT NULL,
	`terminada` integer,
	`codigo` text,
	`premio` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `dia`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_runs_codigo_unique` ON `daily_runs` (`codigo`);--> statement-breakpoint
CREATE INDEX `daily_runs_dia_idx` ON `daily_runs` (`dia`,`fichas`);