PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`user_id` text NOT NULL,
	`texto` text,
	`mano` text,
	`hand_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "messages_content" CHECK("__new_messages"."texto" is not null or "__new_messages"."mano" is not null)
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "group_id", "user_id", "texto", "mano", "hand_id", "created_at") SELECT "id", "group_id", "user_id", "texto", "mano", "hand_id", "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `messages_group_idx` ON `messages` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_created_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_hand_idx` ON `messages` (`group_id`,`hand_id`) WHERE "messages"."hand_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_hand_global_idx` ON `messages` (`hand_id`) WHERE "messages"."hand_id" is not null and "messages"."group_id" is null;--> statement-breakpoint
ALTER TABLE `profiles` ADD `chat_leido` integer;