SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS diagnocare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE diagnocare;

DROP TABLE IF EXISTS reading_queue;
DROP TABLE IF EXISTS critical_alert_escalations;
DROP TABLE IF EXISTS critical_alerts;
DROP TABLE IF EXISTS safety_checklist_responses;
DROP TABLE IF EXISTS safety_checklist_items;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS slots;
DROP TABLE IF EXISTS scan_types;
DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS remember_tokens;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('patient', 'receptionist', 'doctor', 'referring_doctor') NOT NULL DEFAULT 'patient',
    date_of_birth DATE NULL,
    gender ENUM('male', 'female', 'other') NULL,
    registration_no VARCHAR(50) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE remember_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    selector CHAR(24) NOT NULL,
    validator_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_remember_selector (selector),
    KEY idx_remember_user (user_id),
    CONSTRAINT fk_remember_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_attempts_email_time (email, attempted_at),
    KEY idx_attempts_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT 'Pune',
    pincode CHAR(6) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(190) NULL,
    timings VARCHAR(255) NOT NULL,
    map_query VARCHAR(255) NOT NULL,
    image_file VARCHAR(120) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_branches_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE scan_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category ENUM('xray', 'sonography', 'colour_doppler') NOT NULL,
    description VARCHAR(1000) NOT NULL,
    preparation VARCHAR(1000) NULL,
    duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_scan_types_name (name),
    KEY idx_scan_types_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE slots (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    branch_id INT UNSIGNED NOT NULL,
    day_of_week TINYINT UNSIGNED NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_slot_branch_day_time (branch_id, day_of_week, start_time),
    CONSTRAINT chk_slot_day CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT chk_slot_times CHECK (end_time > start_time),
    CONSTRAINT fk_slots_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    scan_type_id INT UNSIGNED NOT NULL,
    slot_id INT UNSIGNED NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    status ENUM('booked', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'booked',
    referring_doctor_id INT UNSIGNED NULL,
    notes VARCHAR(500) NULL,
    created_by INT UNSIGNED NOT NULL,
    booking_lock TINYINT(1) GENERATED ALWAYS AS (IF(status IN ('cancelled', 'no_show'), NULL, 1)) STORED,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_appointment_slot_date (slot_id, appointment_date, booking_lock),
    UNIQUE KEY uq_patient_date_time (patient_id, appointment_date, start_time, booking_lock),
    KEY idx_appointments_branch_date (branch_id, appointment_date),
    KEY idx_appointments_referrer (referring_doctor_id),
    CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES users (id),
    CONSTRAINT fk_appt_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_appt_scan FOREIGN KEY (scan_type_id) REFERENCES scan_types (id),
    CONSTRAINT fk_appt_slot FOREIGN KEY (slot_id) REFERENCES slots (id),
    CONSTRAINT fk_appt_referrer FOREIGN KEY (referring_doctor_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_appt_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNSIGNED NOT NULL,
    appointment_id INT UNSIGNED NULL,
    uploaded_by INT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name CHAR(68) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    cipher VARCHAR(30) NOT NULL DEFAULT 'aes-256-gcm',
    iv VARBINARY(16) NOT NULL,
    auth_tag VARBINARY(16) NOT NULL,
    sha256 CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reports_stored_name (stored_name),
    KEY idx_reports_patient (patient_id),
    CONSTRAINT fk_reports_patient FOREIGN KEY (patient_id) REFERENCES users (id),
    CONSTRAINT fk_reports_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(15) NULL,
    branch_id INT UNSIGNED NULL,
    message VARCHAR(2000) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contact_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE safety_checklist_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    scan_type_id INT UNSIGNED NOT NULL,
    question VARCHAR(255) NOT NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 1,
    blocks_scan_if_yes TINYINT(1) NOT NULL DEFAULT 0,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_checklist_scan FOREIGN KEY (scan_type_id) REFERENCES scan_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE safety_checklist_responses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT UNSIGNED NOT NULL,
    item_id INT UNSIGNED NOT NULL,
    answer ENUM('yes', 'no', 'na') NOT NULL,
    remarks VARCHAR(255) NULL,
    recorded_by INT UNSIGNED NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_checklist_response (appointment_id, item_id),
    CONSTRAINT fk_response_appt FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE,
    CONSTRAINT fk_response_item FOREIGN KEY (item_id) REFERENCES safety_checklist_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_response_user FOREIGN KEY (recorded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE critical_alerts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id INT UNSIGNED NULL,
    appointment_id INT UNSIGNED NULL,
    patient_id INT UNSIGNED NOT NULL,
    raised_by INT UNSIGNED NOT NULL,
    notify_user_id INT UNSIGNED NULL,
    finding VARCHAR(1000) NOT NULL,
    severity ENUM('critical', 'urgent', 'significant') NOT NULL DEFAULT 'critical',
    status ENUM('open', 'acknowledged', 'escalated', 'closed') NOT NULL DEFAULT 'open',
    escalation_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
    acknowledge_by DATETIME NULL,
    acknowledged_by INT UNSIGNED NULL,
    acknowledged_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_alerts_status (status),
    CONSTRAINT fk_alert_report FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE SET NULL,
    CONSTRAINT fk_alert_appt FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
    CONSTRAINT fk_alert_patient FOREIGN KEY (patient_id) REFERENCES users (id),
    CONSTRAINT fk_alert_raiser FOREIGN KEY (raised_by) REFERENCES users (id),
    CONSTRAINT fk_alert_notify FOREIGN KEY (notify_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_alert_ack FOREIGN KEY (acknowledged_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE critical_alert_escalations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    alert_id INT UNSIGNED NOT NULL,
    level TINYINT UNSIGNED NOT NULL,
    escalated_to INT UNSIGNED NULL,
    channel ENUM('dashboard', 'sms', 'email', 'phone') NOT NULL DEFAULT 'dashboard',
    note VARCHAR(255) NULL,
    escalated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_escalation_alert FOREIGN KEY (alert_id) REFERENCES critical_alerts (id) ON DELETE CASCADE,
    CONSTRAINT fk_escalation_user FOREIGN KEY (escalated_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reading_queue (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT UNSIGNED NOT NULL,
    priority ENUM('stat', 'urgent', 'routine') NOT NULL DEFAULT 'routine',
    status ENUM('waiting', 'reading', 'reported') NOT NULL DEFAULT 'waiting',
    assigned_to INT UNSIGNED NULL,
    queued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    UNIQUE KEY uq_queue_appointment (appointment_id),
    KEY idx_queue_priority (status, priority, queued_at),
    CONSTRAINT fk_queue_appt FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE,
    CONSTRAINT fk_queue_assignee FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
