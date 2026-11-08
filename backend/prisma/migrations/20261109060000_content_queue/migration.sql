CREATE TABLE `queue_items` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `file_id` CHAR(36) NOT NULL,
  `target` VARCHAR(191) NULL,
  `caption` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `scheduled_at` DATETIME(3) NULL,
  `claimed_at` DATETIME(3) NULL,
  `posted_at` DATETIME(3) NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `external_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `queue_items_user_id_status_created_at_idx` ON `queue_items`(`user_id`, `status`, `created_at`);
CREATE INDEX `queue_items_user_id_target_status_idx` ON `queue_items`(`user_id`, `target`, `status`);
CREATE INDEX `queue_items_file_id_idx` ON `queue_items`(`file_id`);

ALTER TABLE `queue_items` ADD CONSTRAINT `queue_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `queue_items` ADD CONSTRAINT `queue_items_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
