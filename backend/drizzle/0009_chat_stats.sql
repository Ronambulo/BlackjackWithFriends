-- Rebuilds messages to let the content check take published stats. Migrations run in a
-- transaction, where foreign_keys=OFF does nothing: dropping the old table would cascade
-- to reactions and blank the replies, so both are kept aside and put back.
CREATE TEMP TABLE `__reactions_kept` AS SELECT * FROM `reactions`;--> statement-breakpoint
CREATE TEMP TABLE `__replies_kept` AS SELECT `id`, `reply_to` FROM `messages` WHERE `reply_to` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`user_id` text NOT NULL,
	`texto` text,
	`mano` text,
	`estadisticas` text,
	`hand_id` text,
	`reply_to` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reply_to`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "messages_content" CHECK("texto" is not null or "mano" is not null or "estadisticas" is not null)
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "group_id", "user_id", "texto", "mano", "estadisticas", "hand_id", "reply_to", "created_at") SELECT "id", "group_id", "user_id", "texto", "mano", NULL, "hand_id", NULL, "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
UPDATE `messages` SET `reply_to` = (SELECT `reply_to` FROM `__replies_kept` k WHERE k.`id` = `messages`.`id`) WHERE `id` IN (SELECT `id` FROM `__replies_kept`);--> statement-breakpoint
INSERT OR IGNORE INTO `reactions` SELECT * FROM `__reactions_kept`;--> statement-breakpoint
DROP TABLE `__reactions_kept`;--> statement-breakpoint
DROP TABLE `__replies_kept`;--> statement-breakpoint
CREATE INDEX `messages_group_idx` ON `messages` (`group_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_created_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_hand_idx` ON `messages` (`group_id`,`hand_id`) WHERE "messages"."hand_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_hand_global_idx` ON `messages` (`hand_id`) WHERE "messages"."hand_id" is not null and "messages"."group_id" is null;
