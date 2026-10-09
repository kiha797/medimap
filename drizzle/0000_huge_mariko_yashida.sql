CREATE TABLE `customers` (
	`version` text NOT NULL,
	`row` integer NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`institution_id` text,
	`status` text NOT NULL,
	PRIMARY KEY(`version`, `row`)
);
--> statement-breakpoint
CREATE INDEX `idx_custom_match` ON `customers` (`version`,`institution_id`);--> statement-breakpoint
CREATE TABLE `institutions` (
	`generation` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`sido` text NOT NULL,
	`sigungu` text NOT NULL,
	`dong` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`lat` text NOT NULL,
	`lng` text NOT NULL,
	`name_norm` text NOT NULL,
	`address_norm` text NOT NULL,
	`phone_norm` text NOT NULL,
	PRIMARY KEY(`generation`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_inst_region` ON `institutions` (`generation`,`sido`,`sigungu`,`dong`);--> statement-breakpoint
CREATE INDEX `idx_inst_name` ON `institutions` (`generation`,`name_norm`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
