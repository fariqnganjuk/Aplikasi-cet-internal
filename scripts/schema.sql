USE akselera_chat;
DROP TABLE IF EXISTS users_simple;
DROP TABLE IF EXISTS t1;
DROP TABLE IF EXISTS t2;
DROP TABLE IF EXISTS t3;
CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `initials` VARCHAR(8) NOT NULL,
  `avatar_color` VARCHAR(32) NOT NULL DEFAULT '#27272A',
  `is_online` TINYINT(1) NOT NULL DEFAULT 0,
  `last_seen` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `conversations` (
  `id` VARCHAR(191) NOT NULL,
  `user_a_id` VARCHAR(191) NOT NULL,
  `user_b_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE KEY `conversations_pair_uniq` (`user_a_id`, `user_b_id`),
  KEY `conversations_user_a_idx` (`user_a_id`),
  KEY `conversations_user_b_idx` (`user_b_id`),
  CONSTRAINT `conversations_a_fk` FOREIGN KEY (`user_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_b_fk` FOREIGN KEY (`user_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` VARCHAR(191) NOT NULL,
  `conversation_id` VARCHAR(191) NOT NULL,
  `sender_id` VARCHAR(191) NOT NULL,
  `recipient_id` VARCHAR(191) NOT NULL,
  `text` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  KEY `messages_conversation_idx` (`conversation_id`, `created_at`),
  CONSTRAINT `messages_conv_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_sender_fk` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_recipient_fk` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW TABLES;
DESCRIBE `users`;
