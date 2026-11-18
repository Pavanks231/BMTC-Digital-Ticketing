import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { pool } from '../config/database.js';
import { seedDatabase } from './seedDatabase.js';

const databaseName = process.env.DB_NAME || 'bmtc_ticketing';
if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('DB_NAME may contain only letters, digits, and underscores.');
}

const schemaUrl = new URL('../database/schema.sql', import.meta.url);
const schema = (await readFile(schemaUrl, 'utf8')).replaceAll('bmtc_ticketing', databaseName);
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
});

try {
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
    await connection.query(statement);
  }

  const [passPublicIdColumns] = await connection.execute(
    `SELECT COLUMN_NAME, IS_NULLABLE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_passes' AND COLUMN_NAME = 'pass_public_id'`,
    [databaseName],
  );
  if (!passPublicIdColumns.length) {
    await connection.query('ALTER TABLE student_passes ADD COLUMN pass_public_id CHAR(36) NULL AFTER passenger_id');
  }
  const [passesMissingPublicIds] = await connection.execute(
    'SELECT student_pass_id FROM student_passes WHERE pass_public_id IS NULL',
  );
  for (const row of passesMissingPublicIds) {
    await connection.execute(
      'UPDATE student_passes SET pass_public_id = ? WHERE student_pass_id = ?',
      [randomUUID(), row.student_pass_id],
    );
  }
  if (!passPublicIdColumns.length || passPublicIdColumns[0].IS_NULLABLE === 'YES') {
    await connection.query('ALTER TABLE student_passes MODIFY COLUMN pass_public_id CHAR(36) NOT NULL');
  }

  const [passPublicIdIndexes] = await connection.execute(
    `SELECT INDEX_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_passes' AND INDEX_NAME = 'uq_student_passes_public_id'`,
    [databaseName],
  );
  if (!passPublicIdIndexes.length) {
    await connection.query('ALTER TABLE student_passes ADD UNIQUE KEY uq_student_passes_public_id (pass_public_id)');
  }

  const [passRouteColumns] = await connection.execute(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_passes' AND COLUMN_NAME = 'route_code'`,
    [databaseName],
  );
  if (!passRouteColumns.length) {
    await connection.query('ALTER TABLE student_passes ADD COLUMN route_code VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER pass_public_id');
  }
  const [passRouteIndexes] = await connection.execute(
    `SELECT INDEX_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_passes' AND INDEX_NAME = 'idx_student_passes_route_code'`,
    [databaseName],
  );
  if (!passRouteIndexes.length) {
    await connection.query('ALTER TABLE student_passes ADD KEY idx_student_passes_route_code (route_code)');
  }
  const [passRouteForeignKeys] = await connection.execute(
    `SELECT CONSTRAINT_NAME
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_passes'
        AND CONSTRAINT_NAME = 'fk_student_passes_route'`,
    [databaseName],
  );
  if (!passRouteForeignKeys.length) {
    await connection.query(
      `ALTER TABLE student_passes
         ADD CONSTRAINT fk_student_passes_route
         FOREIGN KEY (route_code) REFERENCES routes (route_code)
         ON DELETE RESTRICT`,
    );
  }

  const [studentPassColumns] = await connection.execute(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'student_pass_id'`,
    [databaseName],
  );
  if (!studentPassColumns.length) {
    await connection.query(
      'ALTER TABLE tickets ADD COLUMN student_pass_id BIGINT UNSIGNED NULL AFTER fare_schedule_id',
    );
  }

  const [studentPassIndexes] = await connection.execute(
    `SELECT INDEX_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets' AND INDEX_NAME = 'uq_tickets_trip_student_pass'`,
    [databaseName],
  );
  if (!studentPassIndexes.length) {
    await connection.query(
      'ALTER TABLE tickets ADD UNIQUE KEY uq_tickets_trip_student_pass (trip_id, student_pass_id)',
    );
  }

  const [studentPassForeignKeys] = await connection.execute(
    `SELECT CONSTRAINT_NAME
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets'
        AND CONSTRAINT_NAME = 'fk_tickets_student_pass'`,
    [databaseName],
  );
  if (!studentPassForeignKeys.length) {
    await connection.query(
      `ALTER TABLE tickets
         ADD CONSTRAINT fk_tickets_student_pass
         FOREIGN KEY (student_pass_id) REFERENCES student_passes (student_pass_id)
         ON DELETE RESTRICT`,
    );
  }
} finally {
  await connection.end();
}

try {
  await seedDatabase();
} finally {
  await pool.end();
}
