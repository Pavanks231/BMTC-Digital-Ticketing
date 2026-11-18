import { pool } from '../config/database.js';

export async function findConductorActiveTripForUpdate(connection, conductorId) {
  const [rows] = await connection.execute(
    `SELECT trip_id, trip_code, bus_id
       FROM trips
      WHERE conductor_id = ? AND status = 'running'
      ORDER BY started_at DESC, trip_id DESC
      LIMIT 1
      FOR UPDATE`,
    [conductorId],
  );
  const row = rows[0];
  return row ? {
    id: Number(row.trip_id),
    code: row.trip_code,
    busId: Number(row.bus_id),
  } : null;
}

export async function findTicketForUpdate(connection, publicId) {
  const [rows] = await connection.execute(
    `SELECT ticket_id, trip_id, status, used_at
       FROM tickets
      WHERE public_id = ?
      LIMIT 1
      FOR UPDATE`,
    [publicId],
  );
  const row = rows[0];
  return row ? {
    id: Number(row.ticket_id),
    tripId: Number(row.trip_id),
    status: row.status,
    usedAt: row.used_at,
  } : null;
}

export async function markTicketUsed(connection, ticketId) {
  const [result] = await connection.execute(
    `UPDATE tickets
        SET status = 'used', used_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ? AND status = 'valid'`,
    [ticketId],
  );
  return result.affectedRows;
}

export async function recordTicketVerification(connection, { publicId, ticketId, conductorId, tripId, result }) {
  const [insertResult] = await connection.execute(
    `INSERT INTO ticket_verifications
       (scanned_public_id, ticket_id, conductor_id, trip_id, result)
     VALUES (?, ?, ?, ?, ?)`,
    [publicId, ticketId, conductorId, tripId, result],
  );
  return Number(insertResult.insertId);
}

export async function findVerifiedTicketDetails(connection, ticketId) {
  const [rows] = await connection.execute(
    `SELECT t.public_id, t.status, t.used_at, t.fare_total, t.currency, t.passenger_total,
            tr.trip_code, b.registration_number,
            r.route_code, r.route_name, rd.direction_name,
            boarding_stop.stop_name AS boarding_stop_name,
            destination_stop.stop_name AS destination_stop_name
       FROM tickets t
       JOIN trips tr ON tr.trip_id = t.trip_id
       JOIN buses b ON b.bus_id = tr.bus_id
       JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
       JOIN routes r ON r.route_code = rd.route_code
       JOIN route_stops boarding_rs
         ON boarding_rs.route_direction_id = t.route_direction_id
        AND boarding_rs.sequence_number = t.boarding_stop_sequence
       JOIN stops boarding_stop ON boarding_stop.stop_id = boarding_rs.stop_id
       JOIN route_stops destination_rs
         ON destination_rs.route_direction_id = t.route_direction_id
        AND destination_rs.sequence_number = t.destination_stop_sequence
       JOIN stops destination_stop ON destination_stop.stop_id = destination_rs.stop_id
      WHERE t.ticket_id = ?
      LIMIT 1`,
    [ticketId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    reference: row.public_id.slice(0, 8).toUpperCase(),
    status: row.status,
    usedAt: row.used_at,
    busRegistrationNumber: row.registration_number,
    tripCode: row.trip_code,
    routeCode: row.route_code,
    routeName: row.route_name,
    direction: row.direction_name,
    boardingStop: row.boarding_stop_name,
    destinationStop: row.destination_stop_name,
    passengerCount: Number(row.passenger_total),
    fareTotal: Number(row.fare_total),
    currency: row.currency,
  };
}

export async function listConductorTicketVerifications(conductorId) {
  const [rows] = await pool.execute(
    `SELECT v.scanned_public_id, v.result, v.verified_at,
            tr.trip_code, b.registration_number,
            r.route_code, r.route_name, rd.direction_name,
            boarding_stop.stop_name AS boarding_stop_name,
            destination_stop.stop_name AS destination_stop_name
       FROM ticket_verifications v
       LEFT JOIN trips tr ON tr.trip_id = v.trip_id
       LEFT JOIN buses b ON b.bus_id = tr.bus_id
       LEFT JOIN tickets t ON t.ticket_id = v.ticket_id
       LEFT JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
       LEFT JOIN routes r ON r.route_code = rd.route_code
       LEFT JOIN route_stops boarding_rs
         ON boarding_rs.route_direction_id = t.route_direction_id
        AND boarding_rs.sequence_number = t.boarding_stop_sequence
       LEFT JOIN stops boarding_stop ON boarding_stop.stop_id = boarding_rs.stop_id
       LEFT JOIN route_stops destination_rs
         ON destination_rs.route_direction_id = t.route_direction_id
        AND destination_rs.sequence_number = t.destination_stop_sequence
       LEFT JOIN stops destination_stop ON destination_stop.stop_id = destination_rs.stop_id
      WHERE v.conductor_id = ?
      ORDER BY v.verified_at DESC, v.verification_id DESC
      LIMIT 50`,
    [conductorId],
  );

  return rows.map((row) => ({
    reference: row.scanned_public_id.slice(0, 8).toUpperCase(),
    result: row.result,
    verifiedAt: row.verified_at,
    tripCode: row.trip_code,
    busRegistrationNumber: row.registration_number,
    routeCode: row.route_code,
    routeName: row.route_name,
    direction: row.direction_name,
    boardingStop: row.boarding_stop_name,
    destinationStop: row.destination_stop_name,
  }));
}
