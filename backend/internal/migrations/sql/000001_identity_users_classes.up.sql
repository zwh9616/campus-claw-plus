CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 role ENUM('teacher','student') NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 security_version BIGINT NOT NULL DEFAULT 1,
 UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS classes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 stable_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 name VARCHAR(128) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE KEY uq_classes_key (stable_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
CREATE TABLE IF NOT EXISTS class_memberships (
 user_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY (user_id,class_id),
 KEY ix_membership_class (class_id),
 CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(id),
 CONSTRAINT fk_membership_class FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB;
