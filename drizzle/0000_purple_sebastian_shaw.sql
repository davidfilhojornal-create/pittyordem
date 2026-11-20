CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_key` text NOT NULL,
	`playlist_url` text NOT NULL,
	`title` text NOT NULL,
	`order_json` text NOT NULL,
	`verified_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_playlist_key_unique` ON `submissions` (`playlist_key`);