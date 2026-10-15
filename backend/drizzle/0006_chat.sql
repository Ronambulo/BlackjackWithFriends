CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`texto` text,
	`mano` text,
	`hand_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "messages_content" CHECK("messages"."texto" is not null or "messages"."mano" is not null)
);
--> statement-breakpoint
CREATE INDEX `messages_group_idx` ON `messages` (`group_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_hand_idx` ON `messages` (`group_id`,`hand_id`) WHERE "messages"."hand_id" is not null;--> statement-breakpoint
CREATE TABLE `reactions` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `group_members` ADD `chat_leido` integer;