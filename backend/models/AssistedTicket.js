export async function findConductorAssistedTripForUpdate(connection, conductorId) {
  const [rows] = await connection.execute(
    `SELECT t.trip_id, t.trip_code, t.bus_id, t.current_stop_sequence,
            t.route_direction_id, rd.route_code, rd.direction_name, b.registration_number
       FROM trips t
       JOIN buses b ON b.bus_id = t.bus_id
       JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
      WHERE t.conductor_id = ? AND t.status = 'running'
      ORDER BY t.started_at DESC, t.trip_id DESC
      LIMIT 1
      FOR UPDATE`,
    [conductorId],
  );
  const row = rows[0];
  return row ? {
    id: Number(row.trip_id),
    code: row.trip_code,
    busId: Number(row.bus_id),
    busRegistrationNumber: row.registration_number,
    currentStopSequence: row.current_stop_sequence === null
      ? null
      : Number(row.current_stop_sequence),
    routeDirectionId: Number(row.route_direction_id),
    routeCode: row.route_code,
    direction: row.direction_name,
  } : null;
}

export async function findStudentPassForAssistedTicket(connection, passPublicId) {
  const [rows] = await connection.execute(
    `SELECT sp.student_pass_id, sp.passenger_id, sp.route_code, pass_route.route_name,
            sp.status,
            p.is_active AS passenger_is_active,
            (CURDATE() BETWEEN sp.valid_from AND sp.valid_until) AS pass_is_current
       FROM student_passes sp
       JOIN passengers p ON p.passenger_id = sp.passenger_id
       LEFT JOIN routes pass_route ON pass_route.route_code = sp.route_code
      WHERE sp.pass_public_id = ?
      LIMIT 1
      FOR UPDATE`,
    [passPublicId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.student_pass_id),
    passengerId: Number(row.passenger_id),
    routeCode: row.route_code,
    routeName: row.route_name,
    isValid: Boolean(row.passenger_is_active)
      && row.status === 'verified'
      && Boolean(row.pass_is_current),
  };
}
