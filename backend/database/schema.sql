CREATE DATABASE IF NOT EXISTS bmtc_ticketing
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE bmtc_ticketing;

CREATE TABLE IF NOT EXISTS passengers (
  passenger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (passenger_id),
  UNIQUE KEY uq_passengers_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_passes (
  student_pass_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  passenger_id BIGINT UNSIGNED NOT NULL,
  pass_public_id CHAR(36) NOT NULL,
  route_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  pass_number VARCHAR(40) NOT NULL,
  institution_name VARCHAR(150) NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  verification_source VARCHAR(30) NOT NULL DEFAULT 'manual_review',
  verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_pass_id),
  UNIQUE KEY uq_student_passes_public_id (pass_public_id),
  UNIQUE KEY uq_student_passes_number (pass_number),
  KEY idx_student_passes_route_code (route_code),
  KEY idx_student_passes_passenger_status (passenger_id, status, valid_until),
  CONSTRAINT fk_student_passes_passenger
    FOREIGN KEY (passenger_id) REFERENCES passengers (passenger_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_student_passes_validity CHECK (valid_until >= valid_from)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conductors (
  conductor_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_number VARCHAR(40) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conductor_id),
  UNIQUE KEY uq_conductors_employee_number (employee_number),
  UNIQUE KEY uq_conductors_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS buses (
  bus_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_number VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bus_id),
  UNIQUE KEY uq_buses_registration_number (registration_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS routes (
  route_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  route_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_name VARCHAR(100) NOT NULL DEFAULT 'provided_workbook',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (route_code),
  KEY idx_routes_name (route_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stops (
  stop_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stop_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stop_id),
  UNIQUE KEY uq_stops_name (stop_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS route_directions (
  route_direction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  direction_name VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  route_description TEXT NOT NULL,
  trip_count INT UNSIGNED NOT NULL DEFAULT 0,
  first_trip TIME NULL,
  last_trip TIME NULL,
  source_stop_count SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (route_direction_id),
  UNIQUE KEY uq_route_directions_route_direction (route_code, direction_name),
  CONSTRAINT fk_route_directions_route
    FOREIGN KEY (route_code) REFERENCES routes (route_code)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS route_stops (
  route_direction_id BIGINT UNSIGNED NOT NULL,
  stop_id BIGINT UNSIGNED NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  distance_from_previous_km DECIMAL(7,3) NULL,
  PRIMARY KEY (route_direction_id, sequence_number),
  KEY idx_route_stops_stop (stop_id),
  CONSTRAINT fk_route_stops_direction
    FOREIGN KEY (route_direction_id) REFERENCES route_directions (route_direction_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_route_stops_stop
    FOREIGN KEY (stop_id) REFERENCES stops (stop_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  trip_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  trip_code VARCHAR(40) NOT NULL,
  bus_id BIGINT UNSIGNED NOT NULL,
  conductor_id BIGINT UNSIGNED NOT NULL,
  route_direction_id BIGINT UNSIGNED NOT NULL,
  current_stop_sequence SMALLINT UNSIGNED NULL,
  status ENUM('scheduled', 'running', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  started_at DATETIME NULL,
  current_stop_updated_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id),
  UNIQUE KEY uq_trips_code (trip_code),
  KEY idx_trips_bus_status (bus_id, status),
  KEY idx_trips_conductor_status (conductor_id, status),
  CONSTRAINT fk_trips_bus
    FOREIGN KEY (bus_id) REFERENCES buses (bus_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_trips_conductor
    FOREIGN KEY (conductor_id) REFERENCES conductors (conductor_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_trips_route_direction
    FOREIGN KEY (route_direction_id) REFERENCES route_directions (route_direction_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_trips_current_route_stop
    FOREIGN KEY (route_direction_id, current_stop_sequence)
    REFERENCES route_stops (route_direction_id, sequence_number)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fare_schedules (
  fare_schedule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_code VARCHAR(64) NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  source_label VARCHAR(200) NOT NULL,
  effective_date_text VARCHAR(80) NULL,
  stage_basis_text VARCHAR(200) NOT NULL,
  source_status ENUM('user_provided', 'verified_official', 'demo') NOT NULL DEFAULT 'user_provided',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (fare_schedule_id),
  UNIQUE KEY uq_fare_schedules_code (schedule_code),
  KEY idx_fare_schedules_service_active (service_type, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fare_rates (
  fare_schedule_id BIGINT UNSIGNED NOT NULL,
  chargeable_stages SMALLINT UNSIGNED NOT NULL,
  distance_km DECIMAL(5,1) NOT NULL,
  adult_fare DECIMAL(7,2) NOT NULL,
  child_fare DECIMAL(7,2) NOT NULL,
  senior_fare DECIMAL(7,2) NOT NULL,
  PRIMARY KEY (fare_schedule_id, chargeable_stages),
  CONSTRAINT fk_fare_rates_schedule
    FOREIGN KEY (fare_schedule_id) REFERENCES fare_schedules (fare_schedule_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_fare_rates_stage CHECK (chargeable_stages BETWEEN 1 AND 30),
  CONSTRAINT chk_fare_rates_amounts CHECK (adult_fare >= 0 AND child_fare >= 0 AND senior_fare >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  passenger_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NOT NULL,
  route_direction_id BIGINT UNSIGNED NOT NULL,
  boarding_stop_sequence SMALLINT UNSIGNED NOT NULL,
  destination_stop_sequence SMALLINT UNSIGNED NOT NULL,
  fare_schedule_id BIGINT UNSIGNED NOT NULL,
  student_pass_id BIGINT UNSIGNED NULL,
  passenger_total SMALLINT UNSIGNED NOT NULL,
  fare_total DECIMAL(8,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  payment_status ENUM('not_required', 'not_integrated') NOT NULL DEFAULT 'not_integrated',
  status ENUM('valid', 'used', 'expired', 'cancelled') NOT NULL DEFAULT 'valid',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  PRIMARY KEY (ticket_id),
  UNIQUE KEY uq_tickets_public_id (public_id),
  KEY idx_tickets_passenger_issued (passenger_id, issued_at),
  KEY idx_tickets_trip_status (trip_id, status),
  UNIQUE KEY uq_tickets_trip_student_pass (trip_id, student_pass_id),
  CONSTRAINT fk_tickets_passenger
    FOREIGN KEY (passenger_id) REFERENCES passengers (passenger_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_trip
    FOREIGN KEY (trip_id) REFERENCES trips (trip_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_route_direction
    FOREIGN KEY (route_direction_id) REFERENCES route_directions (route_direction_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_boarding_stop
    FOREIGN KEY (route_direction_id, boarding_stop_sequence)
    REFERENCES route_stops (route_direction_id, sequence_number)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_destination_stop
    FOREIGN KEY (route_direction_id, destination_stop_sequence)
    REFERENCES route_stops (route_direction_id, sequence_number)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_fare_schedule
    FOREIGN KEY (fare_schedule_id) REFERENCES fare_schedules (fare_schedule_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_student_pass
    FOREIGN KEY (student_pass_id) REFERENCES student_passes (student_pass_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_tickets_sequence_order CHECK (destination_stop_sequence > boarding_stop_sequence),
  CONSTRAINT chk_tickets_passenger_total CHECK (passenger_total BETWEEN 1 AND 50),
  CONSTRAINT chk_tickets_fare_total CHECK (fare_total >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_passenger_counts (
  ticket_id BIGINT UNSIGNED NOT NULL,
  category ENUM('general', 'child', 'senior_citizen', 'student') NOT NULL,
  passenger_count SMALLINT UNSIGNED NOT NULL,
  verified_pass_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  subtotal DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (ticket_id, category),
  CONSTRAINT fk_ticket_passenger_counts_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets (ticket_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_ticket_passenger_counts_count CHECK (passenger_count BETWEEN 1 AND 50),
  CONSTRAINT chk_ticket_passenger_counts_verified CHECK (verified_pass_count <= passenger_count),
  CONSTRAINT chk_ticket_passenger_counts_subtotal CHECK (subtotal >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_verifications (
  verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scanned_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ticket_id BIGINT UNSIGNED NULL,
  conductor_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NULL,
  result ENUM('accepted', 'already_used', 'wrong_trip', 'not_valid', 'not_found', 'no_active_trip') NOT NULL,
  verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (verification_id),
  KEY idx_ticket_verifications_conductor_date (conductor_id, verified_at),
  KEY idx_ticket_verifications_ticket (ticket_id, verified_at),
  CONSTRAINT fk_ticket_verifications_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets (ticket_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_ticket_verifications_conductor
    FOREIGN KEY (conductor_id) REFERENCES conductors (conductor_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ticket_verifications_trip
    FOREIGN KEY (trip_id) REFERENCES trips (trip_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
