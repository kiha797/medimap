CREATE TABLE `institution_departments` (
	`generation` text NOT NULL,
	`code` text NOT NULL,
	`snapshot` text NOT NULL,
	`institution_id` text NOT NULL,
	PRIMARY KEY(`generation`, `code`, `snapshot`, `institution_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_department_institution` ON `institution_departments` (`generation`,`institution_id`,`code`);