CREATE TABLE IF NOT EXISTS materials (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 class_id BIGINT UNSIGNED NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 version INT NOT NULL,
 index_status ENUM('pending','indexing','ready','failed','deleted') NOT NULL DEFAULT 'pending',
 raw_bytes MEDIUMBLOB NOT NULL,
 size_bytes INT NOT NULL,
 body MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_material_version(id,class_id,version),
 KEY ix_material_class(class_id,index_status,id),
 KEY ix_material_creator(created_by),
 CONSTRAINT fk_material_class FOREIGN KEY(class_id) REFERENCES classes(id),
 CONSTRAINT fk_material_creator FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS material_idempotency (
 user_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 idempotency_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 material_id BIGINT UNSIGNED NOT NULL,
 material_version INT NOT NULL,
 PRIMARY KEY(user_id,class_id,idempotency_key),
 KEY ix_replay_material(material_id,class_id,material_version),
 CONSTRAINT fk_replay_user FOREIGN KEY(user_id) REFERENCES users(id),
 CONSTRAINT fk_replay_material FOREIGN KEY(material_id,class_id,material_version) REFERENCES materials(id,class_id,version)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS material_chunks (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 class_id BIGINT UNSIGNED NOT NULL,
 material_id BIGINT UNSIGNED NOT NULL,
 material_version INT NOT NULL,
 ordinal INT NOT NULL,
 char_start INT NOT NULL,
 char_end INT NOT NULL,
 quote TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_chunk_ordinal(material_id,class_id,material_version,ordinal),
 KEY ix_chunk_class(class_id,material_id,material_version,ordinal),
 CONSTRAINT fk_chunk_material FOREIGN KEY(material_id,class_id,material_version) REFERENCES materials(id,class_id,version)
) ENGINE=InnoDB;
