import { pool } from '../config/database.js';

export async function findPassengerByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT passenger_id, full_name, email, password_hash, is_active
       FROM passengers
      WHERE email = ?
      LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}

export async function createPassenger({ fullName, email, passwordHash }) {
  const [result] = await pool.execute(
    `INSERT INTO passengers (full_name, email, password_hash)
     VALUES (?, ?, ?)`,
    [fullName, email, passwordHash],
  );

  return Number(result.insertId);
}

export async function findPublicPassengerById(passengerId) {
  const [rows] = await pool.execute(
    `SELECT p.passenger_id, p.full_name, p.email, p.created_at,
            EXISTS (
              SELECT 1
                FROM student_passes sp
               WHERE sp.passenger_id = p.passenger_id
                 AND sp.status = 'verified'
                 AND CURDATE() BETWEEN sp.valid_from AND sp.valid_until
            ) AS has_valid_student_pass
       FROM passengers p
      WHERE p.passenger_id = ? AND p.is_active = TRUE
      LIMIT 1`,
    [passengerId],
  );

  const passenger = rows[0];
  if (!passenger) return null;

  return {
    id: Number(passenger.passenger_id),
    fullName: passenger.full_name,
    email: passenger.email,
    createdAt: passenger.created_at,
    hasValidStudentPass: Boolean(passenger.has_valid_student_pass),
  };
}
