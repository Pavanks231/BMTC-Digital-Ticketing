import { pool } from '../config/database.js';

function toLikePattern(search) {
  const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

export async function listActiveRoutes(search = '') {
  const pattern = toLikePattern(search);
  const [rows] = await pool.execute(
    `SELECT r.route_code, r.route_name,
            rd.route_direction_id, rd.direction_name, rd.route_description,
            rd.source_stop_count, rd.trip_count, rd.first_trip, rd.last_trip
       FROM routes r
       LEFT JOIN route_directions rd ON rd.route_code = r.route_code
      WHERE r.is_active = TRUE
        AND (? = '' OR r.route_code LIKE ? OR r.route_name LIKE ? OR EXISTS (
          SELECT 1
            FROM route_directions search_rd
            JOIN route_stops search_rs ON search_rs.route_direction_id = search_rd.route_direction_id
            JOIN stops search_s ON search_s.stop_id = search_rs.stop_id
           WHERE search_rd.route_code = r.route_code AND search_s.stop_name LIKE ?
        ))
      ORDER BY r.route_code ASC, rd.direction_name ASC`,
    [search, pattern, pattern, pattern],
  );

  const routeByCode = new Map();
  for (const row of rows) {
    let route = routeByCode.get(row.route_code);
    if (!route) {
      route = { routeCode: row.route_code, routeName: row.route_name, directions: [] };
      routeByCode.set(row.route_code, route);
    }
    if (row.route_direction_id) {
      route.directions.push({
        name: row.direction_name,
        description: row.route_description,
        stopCount: Number(row.source_stop_count),
        scheduledTrips: Number(row.trip_count),
        firstTrip: row.first_trip,
        lastTrip: row.last_trip,
      });
    }
  }
  return [...routeByCode.values()];
}

export async function findRouteDirection(routeCode, direction) {
  const [rows] = await pool.execute(
    `SELECT r.route_code, r.route_name, r.source_name,
            rd.route_direction_id, rd.direction_name, rd.route_description,
            rd.source_stop_count, rd.trip_count, rd.first_trip, rd.last_trip
       FROM routes r
       JOIN route_directions rd ON rd.route_code = r.route_code
      WHERE r.route_code = ? AND rd.direction_name = ? AND r.is_active = TRUE
      LIMIT 1`,
    [routeCode, direction],
  );
  const row = rows[0];
  if (!row) return null;

  const [stopRows] = await pool.execute(
    `SELECT rs.sequence_number, rs.distance_from_previous_km, s.stop_name
       FROM route_stops rs
       JOIN stops s ON s.stop_id = rs.stop_id
      WHERE rs.route_direction_id = ?
      ORDER BY rs.sequence_number ASC`,
    [row.route_direction_id],
  );

  return {
    routeCode: row.route_code,
    routeName: row.route_name,
    source: row.source_name,
    direction: row.direction_name,
    description: row.route_description,
    scheduledTrips: Number(row.trip_count),
    firstTrip: row.first_trip,
    lastTrip: row.last_trip,
    stops: stopRows.map((stop) => ({
      sequence: Number(stop.sequence_number),
      name: stop.stop_name,
      distanceFromPreviousKm: stop.distance_from_previous_km === null
        ? null
        : Number(stop.distance_from_previous_km),
    })),
  };
}

export async function listActiveBuses() {
  const [rows] = await pool.execute(
    `SELECT b.bus_id, b.registration_number,
            t.trip_code, t.status AS trip_status, t.current_stop_sequence,
            r.route_code, r.route_name, rd.direction_name,
            current_s.stop_name AS current_stop_name
       FROM buses b
       LEFT JOIN trips t ON t.trip_id = (
         SELECT assigned_trip.trip_id
           FROM trips assigned_trip
          WHERE assigned_trip.bus_id = b.bus_id AND assigned_trip.status = 'running'
          ORDER BY assigned_trip.started_at DESC, assigned_trip.trip_id DESC
          LIMIT 1
       )
       LEFT JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
       LEFT JOIN routes r ON r.route_code = rd.route_code
       LEFT JOIN route_stops current_rs
         ON current_rs.route_direction_id = t.route_direction_id
        AND current_rs.sequence_number = t.current_stop_sequence
       LEFT JOIN stops current_s ON current_s.stop_id = current_rs.stop_id
      WHERE b.is_active = TRUE
      ORDER BY b.registration_number ASC`,
  );

  return rows.map((row) => ({
    id: Number(row.bus_id),
    registrationNumber: row.registration_number,
    staticQrValue: `bmtc://bus/${encodeURIComponent(row.registration_number)}`,
    status: row.trip_code ? 'running' : 'available',
    trip: row.trip_code ? {
      code: row.trip_code,
      routeCode: row.route_code,
      routeName: row.route_name,
      direction: row.direction_name,
      currentStop: row.current_stop_name,
    } : null,
  }));
}

export async function findBusBoardingInfo(registrationNumber) {
  const [busRows] = await pool.execute(
    `SELECT bus_id, registration_number
       FROM buses
      WHERE registration_number = ? AND is_active = TRUE
      LIMIT 1`,
    [registrationNumber],
  );
  const bus = busRows[0];
  if (!bus) return null;

  const [tripRows] = await pool.execute(
    `SELECT t.trip_code, t.status, t.current_stop_sequence, t.route_direction_id,
            r.route_code, r.route_name, rd.direction_name, rd.route_description,
            current_s.stop_name AS boarding_stop
       FROM trips t
       JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
       JOIN routes r ON r.route_code = rd.route_code
       LEFT JOIN route_stops current_rs
         ON current_rs.route_direction_id = t.route_direction_id
        AND current_rs.sequence_number = t.current_stop_sequence
       LEFT JOIN stops current_s ON current_s.stop_id = current_rs.stop_id
      WHERE t.bus_id = ? AND t.status = 'running'
      ORDER BY t.started_at DESC, t.trip_id DESC
      LIMIT 1`,
    [bus.bus_id],
  );
  const trip = tripRows[0];
  const [stopRows] = trip
    ? await pool.execute(
      `SELECT rs.sequence_number, s.stop_name
         FROM route_stops rs
         JOIN stops s ON s.stop_id = rs.stop_id
        WHERE rs.route_direction_id = ?
        ORDER BY rs.sequence_number ASC`,
      [trip.route_direction_id],
    )
    : [[]];
  const currentStopSequence = trip?.current_stop_sequence === null
    ? null
    : trip ? Number(trip.current_stop_sequence) : null;
  const stops = stopRows.map((stop) => ({
    sequence: Number(stop.sequence_number),
    name: stop.stop_name,
  }));

  return {
    bus: { registrationNumber: bus.registration_number },
    trip: trip ? {
      code: trip.trip_code,
      status: trip.status,
      routeCode: trip.route_code,
      routeName: trip.route_name,
      direction: trip.direction_name,
      description: trip.route_description,
      boardingStop: trip.boarding_stop,
      boardingStopSequence: currentStopSequence,
      destinations: currentStopSequence === null
        ? []
        : stops.filter((stop) => stop.sequence > currentStopSequence),
    } : null,
  };
}

export async function findBusFareQuoteContext(registrationNumber, executor = pool, lockActiveTrip = false) {
  const [busRows] = await executor.execute(
    `SELECT bus_id, registration_number
       FROM buses
      WHERE registration_number = ? AND is_active = TRUE
      LIMIT 1`,
    [registrationNumber],
  );
  const bus = busRows[0];
  if (!bus) return null;

  const lockClause = lockActiveTrip ? '\n      FOR UPDATE' : '';
  const [tripRows] = await executor.execute(
    `SELECT t.trip_id, t.trip_code, t.status, t.current_stop_sequence, t.route_direction_id,
            r.route_code, r.route_name, rd.direction_name, rd.route_description
       FROM trips t
       JOIN route_directions rd ON rd.route_direction_id = t.route_direction_id
       JOIN routes r ON r.route_code = rd.route_code
      WHERE t.bus_id = ? AND t.status = 'running'
      ORDER BY t.started_at DESC, t.trip_id DESC
      LIMIT 1${lockClause}`,
    [bus.bus_id],
  );
  const trip = tripRows[0];
  if (!trip) return { bus, trip: null, stops: [] };

  const [stopRows] = await executor.execute(
    `SELECT rs.sequence_number, s.stop_name
       FROM route_stops rs
       JOIN stops s ON s.stop_id = rs.stop_id
      WHERE rs.route_direction_id = ?
      ORDER BY rs.sequence_number ASC`,
    [trip.route_direction_id],
  );

  return {
    bus,
    trip: {
      id: Number(trip.trip_id),
      routeDirectionId: Number(trip.route_direction_id),
      code: trip.trip_code,
      status: trip.status,
      currentStopSequence: trip.current_stop_sequence === null
        ? null
        : Number(trip.current_stop_sequence),
      routeCode: trip.route_code,
      routeName: trip.route_name,
      direction: trip.direction_name,
      description: trip.route_description,
    },
    stops: stopRows.map((stop) => ({
      sequence: Number(stop.sequence_number),
      name: stop.stop_name,
    })),
  };
}

export async function findActiveOrdinaryFareRates(executor = pool) {
  const [rows] = await executor.execute(
    `SELECT fs.fare_schedule_id, fs.schedule_code, fs.source_label, fs.effective_date_text,
            fs.source_status, fs.currency,
            fr.chargeable_stages, fr.distance_km,
            fr.adult_fare, fr.child_fare, fr.senior_fare
       FROM fare_schedules fs
       LEFT JOIN fare_rates fr ON fr.fare_schedule_id = fs.fare_schedule_id
      WHERE fs.fare_schedule_id = (
        SELECT active_schedule.fare_schedule_id
          FROM fare_schedules active_schedule
         WHERE active_schedule.service_type = 'ordinary' AND active_schedule.is_active = TRUE
         ORDER BY active_schedule.fare_schedule_id DESC
         LIMIT 1
      )
      ORDER BY fr.chargeable_stages ASC`,
  );
  if (!rows.length) return null;
  const schedule = rows[0];
  return {
    schedule: {
      id: Number(schedule.fare_schedule_id),
      code: schedule.schedule_code,
      sourceLabel: schedule.source_label,
      effectiveDateText: schedule.effective_date_text,
      sourceStatus: schedule.source_status,
      currency: schedule.currency,
    },
    ratesByStage: new Map(rows.filter((row) => row.chargeable_stages !== null).map((row) => [
      Number(row.chargeable_stages),
      {
        adult: Number(row.adult_fare),
        child: Number(row.child_fare),
        senior: Number(row.senior_fare),
      },
    ])),
  };
}

export async function findCurrentVerifiedStudentPass(passengerId, routeCode, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT sp.student_pass_id
       FROM passengers p
       JOIN student_passes sp ON sp.passenger_id = p.passenger_id
      WHERE p.passenger_id = ? AND p.is_active = TRUE
        AND sp.status = 'verified'
        AND sp.route_code = ?
        AND CURDATE() BETWEEN sp.valid_from AND sp.valid_until
      ORDER BY sp.valid_until DESC, sp.student_pass_id DESC
      LIMIT 1`,
    [passengerId, routeCode],
  );
  return rows[0] ? { id: Number(rows[0].student_pass_id) } : null;
}
