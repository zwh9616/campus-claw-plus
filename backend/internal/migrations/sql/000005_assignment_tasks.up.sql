CREATE TABLE IF NOT EXISTS assignments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 class_id BIGINT UNSIGNED NOT NULL,
 teacher_id BIGINT UNSIGNED NOT NULL,
 title VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 description MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 deadline DATETIME(3) NOT NULL,
 version BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_assignment_class(id,class_id),
 UNIQUE KEY uq_assignment_version(id,class_id,version),
 KEY ix_assignment_class(class_id,created_at,id),
 KEY ix_assignment_teacher(teacher_id),
 CONSTRAINT fk_assignment_class FOREIGN KEY(class_id) REFERENCES classes(id),
 CONSTRAINT fk_assignment_teacher FOREIGN KEY(teacher_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS submissions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 assignment_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 assignment_version BIGINT UNSIGNED NOT NULL,
 student_id BIGINT UNSIGNED NOT NULL,
 answer MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_submission_scope(id,assignment_id,class_id,student_id),
 KEY ix_submission_assignment(assignment_id,class_id,assignment_version),
 KEY ix_submission_class(assignment_id,class_id,created_at,id),
 KEY ix_submission_student(student_id,assignment_id,class_id,created_at,id),
 CONSTRAINT fk_submission_assignment FOREIGN KEY(assignment_id,class_id,assignment_version) REFERENCES assignments(id,class_id,version),
 CONSTRAINT fk_submission_student FOREIGN KEY(student_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tasks (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 submission_id BIGINT UNSIGNED NOT NULL,
 status ENUM('pending','running','succeeded','failed','cancelled') NOT NULL,
 attempt INT NOT NULL,
 execution_epoch BIGINT UNSIGNED NOT NULL,
 version BIGINT UNSIGNED NOT NULL,
 cancel_requested TINYINT(1) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 error_code ENUM('EXECUTION_FAILED','RETRY_EXHAUSTED') NULL,
 worker_owner CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 lease_until DATETIME(3) NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_task_submission(submission_id),
 UNIQUE KEY uq_task_receipt(id,submission_id),
 KEY ix_task_lease(status,lease_until,id),
 CONSTRAINT fk_task_submission FOREIGN KEY(submission_id) REFERENCES submissions(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS task_outbox (
 task_id BIGINT UNSIGNED NOT NULL,
 available_at DATETIME(3) NOT NULL,
 delivery_state ENUM('pending','leased','closed') NOT NULL,
 PRIMARY KEY(task_id),
 KEY ix_outbox_delivery(delivery_state,available_at,task_id),
 CONSTRAINT fk_outbox_task FOREIGN KEY(task_id) REFERENCES tasks(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS submission_idempotency (
 user_id BIGINT UNSIGNED NOT NULL,
 class_id BIGINT UNSIGNED NOT NULL,
 route VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 assignment_id BIGINT UNSIGNED NOT NULL,
 idempotency_key VARBINARY(64) NOT NULL,
 payload_digest BINARY(32) NOT NULL,
 submission_id BIGINT UNSIGNED NOT NULL,
 task_id BIGINT UNSIGNED NOT NULL,
 response_status ENUM('pending') NOT NULL,
 PRIMARY KEY(user_id,class_id,route,assignment_id,idempotency_key),
 KEY ix_submission_replay(submission_id,assignment_id,class_id,user_id),
 KEY ix_task_replay(task_id,submission_id),
 CONSTRAINT fk_submission_replay FOREIGN KEY(submission_id,assignment_id,class_id,user_id) REFERENCES submissions(id,assignment_id,class_id,student_id),
 CONSTRAINT fk_task_replay FOREIGN KEY(task_id,submission_id) REFERENCES tasks(id,submission_id)
) ENGINE=InnoDB;
