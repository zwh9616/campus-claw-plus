CREATE TABLE IF NOT EXISTS documents (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 class_id BIGINT UNSIGNED NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 format ENUM('pdf','docx') NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('queued','processing','ready','needs_ocr','failed') NOT NULL,
 original_bytes MEDIUMBLOB NOT NULL,
 original_digest BINARY(32) NOT NULL,
 size_bytes INT UNSIGNED NOT NULL,
 body MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NULL,
 page_count SMALLINT UNSIGNED NULL,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 failure_reason ENUM('corrupt','encrypted','unsupported_content','resource_limit','parse_timeout','worker_interrupted','internal_failure') NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_document_version(id,class_id,version),
 UNIQUE KEY uq_document_creator(id,class_id,version,created_by),
 KEY ix_document_class(class_id,status,id),
 KEY ix_document_creator(created_by),
 CONSTRAINT fk_document_class FOREIGN KEY(class_id) REFERENCES classes(id),
 CONSTRAINT fk_document_creator FOREIGN KEY(created_by) REFERENCES users(id),
 CONSTRAINT ck_document_original CHECK(size_bytes BETWEEN 1 AND 10485760 AND OCTET_LENGTH(original_bytes)=size_bytes),
 CONSTRAINT ck_document_version CHECK(version=1),
 CONSTRAINT ck_document_attempts CHECK(attempts<=3),
 CONSTRAINT ck_document_state CHECK(
  (status='queued' AND attempts<=2 AND body IS NULL AND page_count IS NULL AND failure_reason IS NULL) OR
  (status='processing' AND attempts BETWEEN 1 AND 3 AND body IS NULL AND page_count IS NULL AND failure_reason IS NULL) OR
  (status='ready' AND attempts BETWEEN 1 AND 3 AND body IS NOT NULL AND OCTET_LENGTH(body) BETWEEN 1 AND 2097152 AND failure_reason IS NULL AND
   ((format='pdf' AND page_count IS NOT NULL AND page_count BETWEEN 1 AND 200) OR (format='docx' AND page_count IS NULL))) OR
  (status='needs_ocr' AND format='pdf' AND attempts BETWEEN 1 AND 3 AND body IS NULL AND page_count IS NOT NULL AND page_count BETWEEN 1 AND 200 AND failure_reason IS NULL) OR
  (status='failed' AND attempts BETWEEN 1 AND 3 AND body IS NULL AND page_count IS NULL AND failure_reason IS NOT NULL)
 )
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS document_locations (
 document_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 document_version INT UNSIGNED NOT NULL,
 unit INT UNSIGNED NOT NULL,
 kind ENUM('pdf_page','docx_paragraph','docx_table_cell') NOT NULL,
 char_start INT UNSIGNED NOT NULL,
 char_end INT UNSIGNED NOT NULL,
 PRIMARY KEY(document_id,class_id,document_version,unit),
 CONSTRAINT fk_location_document FOREIGN KEY(document_id,class_id,document_version) REFERENCES documents(id,class_id,version),
 CONSTRAINT ck_location_unit CHECK(unit BETWEEN 1 AND 20000 AND (kind<>'pdf_page' OR unit<=200)),
 CONSTRAINT ck_location_range CHECK(char_end>char_start AND char_end<=2097152)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS document_chunks (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 document_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 document_version INT UNSIGNED NOT NULL,
 unit INT UNSIGNED NOT NULL,
 ordinal INT UNSIGNED NOT NULL,
 char_start INT UNSIGNED NOT NULL,
 char_end INT UNSIGNED NOT NULL,
 quote TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_document_chunk(document_id,class_id,document_version,unit,ordinal),
 KEY ix_document_chunk_class(class_id,document_id,document_version,unit,ordinal),
 CONSTRAINT fk_chunk_location FOREIGN KEY(document_id,class_id,document_version,unit) REFERENCES document_locations(document_id,class_id,document_version,unit),
 CONSTRAINT ck_document_chunk_ordinal CHECK(ordinal>=1),
 CONSTRAINT ck_document_chunk_range CHECK(char_end>char_start AND char_end<=2097152 AND char_end-char_start<=2000 AND CHAR_LENGTH(quote)=char_end-char_start)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS document_parse_jobs (
 document_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 document_version INT UNSIGNED NOT NULL,
 delivery_state ENUM('pending','leased','closed') NOT NULL,
 available_at DATETIME(3) NOT NULL,
 worker_owner CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 execution_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0,
 lease_until DATETIME(3) NULL,
 PRIMARY KEY(document_id),
 KEY ix_document_job_delivery(delivery_state,available_at,document_id),
 KEY ix_document_job_lease(delivery_state,lease_until,document_id),
 KEY ix_document_job_source(document_id,class_id,document_version),
 CONSTRAINT fk_document_job FOREIGN KEY(document_id,class_id,document_version) REFERENCES documents(id,class_id,version),
 CONSTRAINT ck_document_job_lease CHECK(
  (delivery_state='leased' AND worker_owner IS NOT NULL AND lease_until IS NOT NULL AND execution_epoch>=1) OR
  (delivery_state<>'leased' AND worker_owner IS NULL AND lease_until IS NULL)
 )
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS document_idempotency (
 user_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 idempotency_key VARBINARY(64) NOT NULL,
 payload_digest BINARY(32) NOT NULL,
 document_id BIGINT UNSIGNED NOT NULL,
 document_version INT UNSIGNED NOT NULL,
 response_body MEDIUMBLOB NOT NULL,
 PRIMARY KEY(user_id,class_id,idempotency_key),
 KEY ix_document_replay(document_id,class_id,document_version,user_id),
 CONSTRAINT fk_document_replay FOREIGN KEY(document_id,class_id,document_version,user_id) REFERENCES documents(id,class_id,version,created_by),
 CONSTRAINT ck_document_replay_key CHECK(OCTET_LENGTH(idempotency_key) BETWEEN 16 AND 64),
 CONSTRAINT ck_document_replay_body CHECK(OCTET_LENGTH(response_body) BETWEEN 1 AND 8192 AND JSON_VALID(CONVERT(response_body USING utf8mb4)))
) ENGINE=InnoDB;
