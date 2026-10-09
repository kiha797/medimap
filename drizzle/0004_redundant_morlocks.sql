CREATE TABLE `institution_statistics` (
	`generation` text NOT NULL,
	`level` text NOT NULL,
	`sido` text NOT NULL,
	`sigungu` text NOT NULL,
	`dong` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`total` integer NOT NULL,
	PRIMARY KEY(`generation`, `level`, `sido`, `sigungu`, `dong`, `kind`, `category`)
);
--> statement-breakpoint
CREATE INDEX `idx_inst_phone` ON `institutions` (`generation`,`phone_norm`);--> statement-breakpoint
CREATE INDEX `idx_inst_address` ON `institutions` (`generation`,`address_norm`);--> statement-breakpoint
CREATE INDEX `idx_inst_region_name` ON `institutions` (`generation`,`sido`,`name_norm`);--> statement-breakpoint
CREATE INDEX `idx_inst_order` ON `institutions` (`generation`,`name`);--> statement-breakpoint
CREATE INDEX `idx_inst_region_order` ON `institutions` (`generation`,`sido`,`sigungu`,`dong`,`name`);