CREATE TABLE IF NOT EXISTS auth_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 action VARCHAR(32) CHARACTER SET ascii NOT NULL,
 result VARCHAR(16) CHARACTER SET ascii NOT NULL,
 user_id BIGINT UNSIGNED NULL,
 session_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 request_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 occurred_at DATETIME(3) NOT NULL,
 KEY ix_audit_request (request_id),
 KEY ix_audit_time (occurred_at)
) ENGINE=InnoDB;
