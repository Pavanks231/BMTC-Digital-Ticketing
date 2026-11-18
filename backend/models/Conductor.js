import { pool } from '../config/database.js';

export async function findConductorByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT conductor_id, full_name, email, password_hash, is_active
       FROM conductors
      WHERE email = ?
      LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findConductorDashboard(conductorId) {
  const [rows] = await pool.execute(
    `SELECT c.conductor_id, c.full_name, c.email,
            t.trip_id, t.trip_code, t.status AS trip_status, t.started_at,
            t.current_stop_updated_at,
            t.current_stop_sequence, b.registration_number,
            rd.route_direction_id, rd.direction_name, rd.route_description,
            r.route_code, r.route_name, s.stop_name AS current_stop_name
       FROM conductors c
       LEFT JOIN trips t
         ON t.conductor_id = c.conductor_id AND t.status = 'running'
       LEFT JOIN buses b ON b.bus_id = t.bus_id
       LEFT JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
       LEFT JOIN routes r ON r.route_code = rd.route_code
       LEFT JOIN route_stops current_rs
         ON current_rs.route_direction_id = t.route_direction_id
        AND current_rs.sequence_number = t.current_stop_sequence
       LEFT JOIN stops s ON s.stop_id = current_rs.stop_id
      WHERE c.conductor_id = ? AND c.is_active = TRUE
      ORDER BY t.started_at DESC
      LIMIT 1`,
    [conductorId],
  );
  const row = rows[0];
  if (!row) return null;

  const conductor = {
    id: Number(row.conductor_id),
    fullName: row.full_name,
    email: row.email,
  };
  if (!row.trip_id) return { conductor, trip: null };

  const [stopRows] = await pool.execute(
    `SELECT rs.sequence_number, s.stop_name
       FROM route_stops rs
       JOIN stops s ON s.stop_id = rs.stop_id
      WHERE rs.route_direction_id = ?
      ORDER BY rs.sequence_number ASC`,
    [row.route_direction_id],
  );
  const currentStopSequence = row.current_stop_sequence === null
    ? null
    : Number(row.current_stop_sequence);

  return {
    conductor,
    trip: {
      id: Number(row.trip_id),
      code: row.trip_code,
      status: row.trip_status,
      startedAt: row.started_at,
      busRegistrationNumber: row.registration_number,
      routeCode: row.route_code,
      routeName: row.route_name,
      direction: row.direction_name,
      description: row.route_description,
      currentStop: row.current_stop_name,
      currentStopSequence,
      currentStopUpdatedAt: row.current_stop_updated_at,
      stops: stopRows.map((stop) => ({
        sequence: Number(stop.sequence_number),
        name: stop.stop_name,
        isCurrent: Number(stop.sequence_number) === currentStopSequence,
      })),
    },
  };
}

export async function setConductorTripCurrentStop(conductorId, sequenceNumber) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [tripRows] = await connection.execute(
      `SELECT trip_id, route_direction_id
         FROM trips
        WHERE conductor_id = ? AND status = 'running'
        ORDER BY started_at DESC, trip_id DESC
        LIMIT 1
        FOR UPDATE`,
      [conductorId],
    );
    const trip = tripRows[0];
    if (!trip) {
      await connection.rollback();
      return { result: 'no_active_trip' };
    }

    const [stopRows] = await connection.execute(
      `SELECT sequence_number
         FROM route_stops
        WHERE route_direction_id = ? AND sequence_number = ?
        LIMIT 1`,
      [trip.route_direction_id, sequenceNumber],
    );
    if (!stopRows.length) {
      await connection.rollback();
      return { result: 'stop_not_on_route' };
    }

    await connection.execute(
      `UPDATE trips
          SET current_stop_sequence = ?, current_stop_updated_at = CURRENT_TIMESTAMP
        WHERE trip_id = ? AND conductor_id = ? AND status = 'running'`,
      [sequenceNumber, trip.trip_id, conductorId],
    );
    await connection.commit();
    return { result: 'updated' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
