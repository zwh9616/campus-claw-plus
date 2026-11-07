CREATE TABLE IF NOT EXISTS sessions (
 id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 version BIGINT NOT NULL,
 security_version BIGINT NOT NULL,
 refresh_hash BINARY(32) NOT NULL,
 refresh_expires DATETIME(3) NOT NULL,
 revoked BOOLEAN NOT NULL DEFAULT FALSE,
 UNIQUE KEY uq_session_refresh (refresh_hash),
 KEY ix_session_user (user_id),
 KEY ix_session_class (class_id),
 CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id),
 CONSTRAINT fk_session_class FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS access_credentials (
 token_hash BINARY(32) NOT NULL PRIMARY KEY,
 session_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_version BIGINT NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 KEY ix_access_session (session_id),
 CONSTRAINT fk_access_session FOREIGN KEY (session_id) REFERENCES sessions(id)
) ENGINE=InnoDB;
