CREATE TABLE `business_links` (
	`business_no` text PRIMARY KEY NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`institution_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `business_no` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `companies` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `duplicate_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `conflict` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `source_codes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_custom_business` ON `customers` (`version`,`business_no`) WHERE "customers"."business_no" <> '';