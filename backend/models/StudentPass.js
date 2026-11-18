import { pool } from '../config/database.js';

export async function findCurrentStudentPass(passengerId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT sp.pass_public_id, sp.pass_number, sp.institution_name,
            sp.valid_from, sp.valid_until,
            r.route_code, r.route_name
       FROM student_passes sp
       JOIN passengers p ON p.passenger_id = sp.passenger_id
       JOIN routes r ON r.route_code = sp.route_code
      WHERE sp.passenger_id = ? AND p.is_active = TRUE
        AND sp.status = 'verified'
        AND CURDATE() BETWEEN sp.valid_from AND sp.valid_until
        AND r.is_active = TRUE
      ORDER BY sp.valid_until DESC, sp.student_pass_id DESC
      LIMIT 1`,
    [passengerId],
  );

  const row = rows[0];
  return row ? {
    publicId: row.pass_public_id,
    passNumber: row.pass_number,
    institutionName: row.institution_name,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    routeCode: row.route_code,
    routeName: row.route_name,
  } : null;
}
