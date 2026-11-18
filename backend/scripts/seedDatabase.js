import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

const routesUrl = new URL('../database/data/routes_seed.json', import.meta.url);
const studentsUrl = new URL('../database/data/demo_students.json', import.meta.url);
const conductorsUrl = new URL('../database/data/demo_conductors.json', import.meta.url);
const fareUrl = new URL('../database/data/ordinary_fare_chart.json', import.meta.url);
const routeData = JSON.parse(await readFile(routesUrl, 'utf8'));
const studentData = JSON.parse(await readFile(studentsUrl, 'utf8'));
const conductorData = JSON.parse(await readFile(conductorsUrl, 'utf8'));
const fareData = JSON.parse(await readFile(fareUrl, 'utf8'));

function placeholders(rowCount, columnCount) {
  return Array.from({ length: rowCount }, () => `(${Array(columnCount).fill('?').join(',')})`).join(',');
}

function toSqlTime(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{1,2}:\d{2}$/.test(value)) return `${value}:00`;
  return /^\d{1,2}:\d{2}:\d{2}$/.test(value) ? value : null;
}

function flattenDirections(routes) {
  return routes.flatMap((route) => route.directions.map((direction) => ({
    routeCode: route.routeCode,
    ...direction,
  })));
}

async function insertInChunks(connection, sqlPrefix, rows, columnsPerRow, chunkSize = 300, suffix = '') {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = chunk.flat();
    await connection.execute(`${sqlPrefix} ${placeholders(chunk.length, columnsPerRow)} ${suffix}`, values);
  }
}

function validateSeedData() {
  assert.equal(routeData.routes.length, 200, 'Route seed must contain exactly 200 unique route codes.');
  assert.equal(routeData.routeCodeCount, 200, 'Route seed metadata count must be 200.');
  assert.equal(studentData.students.length, 20, 'Student seed must contain exactly 20 demo students.');
  assert.equal(conductorData.conductors.length, 1, 'Seed must contain one demo conductor.');
  assert.equal(fareData.rates.length, 30, 'Fare chart must contain 30 chargeable stages.');
  assert.equal(new Set(routeData.routes.map((route) => route.routeCode)).size, 200, 'Route codes must be unique.');
  assert.equal(new Set(studentData.students.map((student) => student.email)).size, 20, 'Student emails must be unique.');

  for (const route of routeData.routes) {
    assert.ok(route.routeCode && route.routeName, 'Every route needs a code and name.');
    for (const direction of route.directions) {
      assert.ok(direction.stops.length > 0, `Route ${route.routeCode} has an empty direction.`);
      assert.equal(direction.stops.length, direction.sourceStopCount, `Stop count mismatch in ${route.routeCode}.`);
    }
  }
  for (const student of studentData.students) {
    assert.ok(student.email.endsWith('@example.test'), 'Demo student emails must use the reserved test domain.');
    assert.equal(student.verificationSource, 'demo_seed');
  }
  for (const conductor of conductorData.conductors) {
    assert.ok(conductor.email.endsWith('@example.test'), 'Demo conductor email must use the reserved test domain.');
    assert.ok(conductor.employeeNumber.startsWith('DEMO-'), 'Demo conductor employee number must be synthetic.');
    assert.ok(conductor.busRegistrationNumber.startsWith('TEST-'), 'Demo bus registration must be synthetic.');
    assert.ok(routeData.routes.some((route) => route.routeCode === conductor.routeCode
      && route.directions.some((direction) => direction.direction === conductor.direction)),
    'Demo assignment must reference a seeded route direction.');
  }
  for (const [index, rate] of fareData.rates.entries()) {
    assert.equal(rate.stage, index + 1, 'Fare stages must be continuous from 1 through 30.');
    assert.equal(rate.distanceKm, rate.stage * fareData.distancePerStageKm, 'Fare stage distance does not match the chart.');
  }
}

export async function seedDatabase() {
  validateSeedData();

  const demoPassword = process.env.DEMO_STUDENT_PASSWORD || '';
  if (Buffer.byteLength(demoPassword, 'utf8') < 8 || Buffer.byteLength(demoPassword, 'utf8') > 72) {
    throw new Error('Set DEMO_STUDENT_PASSWORD in backend/.env to a test-only password between 8 and 72 bytes.');
  }
  const conductorPassword = process.env.DEMO_CONDUCTOR_PASSWORD || demoPassword;
  if (Buffer.byteLength(conductorPassword, 'utf8') < 8 || Buffer.byteLength(conductorPassword, 'utf8') > 72) {
    throw new Error('Set DEMO_CONDUCTOR_PASSWORD in backend/.env to a test-only password between 8 and 72 bytes.');
  }

  const directions = flattenDirections(routeData.routes);
  const uniqueStopNames = [...new Set(directions.flatMap((direction) => direction.stops))];
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const conductorPasswordHash = await bcrypt.hash(conductorPassword, 12);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO routes (route_code, route_name, source_name)
       VALUES ${placeholders(routeData.routes.length, 3)}
       ON DUPLICATE KEY UPDATE route_name = VALUES(route_name), source_name = VALUES(source_name)`,
      routeData.routes.flatMap((route) => [route.routeCode, route.routeName, 'provided_workbook']),
    );

    await connection.execute(
      `INSERT INTO stops (stop_name) VALUES ${placeholders(uniqueStopNames.length, 1)}
       ON DUPLICATE KEY UPDATE stop_name = VALUES(stop_name)`,
      uniqueStopNames,
    );

    const directionRows = directions.map((direction) => [
      direction.routeCode,
      direction.direction,
      direction.description,
      direction.tripCount,
      toSqlTime(direction.firstTrip),
      toSqlTime(direction.lastTrip),
      direction.sourceStopCount,
    ]);
    await connection.execute(
      `INSERT INTO route_directions
         (route_code, direction_name, route_description, trip_count, first_trip, last_trip, source_stop_count)
       VALUES ${placeholders(directionRows.length, 7)}
       ON DUPLICATE KEY UPDATE
         route_description = VALUES(route_description), trip_count = VALUES(trip_count),
         first_trip = VALUES(first_trip), last_trip = VALUES(last_trip),
         source_stop_count = VALUES(source_stop_count)`,
      directionRows.flat(),
    );

    const [stopRows] = await connection.query('SELECT stop_id, stop_name FROM stops');
    const stopIdByName = new Map(stopRows.map((stop) => [stop.stop_name, Number(stop.stop_id)]));
    const routeCodes = routeData.routes.map((route) => route.routeCode);
    const codeMarkers = routeCodes.map(() => '?').join(',');
    const [directionRowsByKey] = await connection.execute(
      `SELECT route_direction_id, route_code, direction_name
         FROM route_directions
        WHERE route_code IN (${codeMarkers})`,
      routeCodes,
    );
    const directionIdByKey = new Map(
      directionRowsByKey.map((row) => [`${row.route_code}\u0000${row.direction_name}`, Number(row.route_direction_id)]),
    );
    const demoPassRouteCode = '1000';
    assert.ok(routeData.routes.some((route) => route.routeCode === demoPassRouteCode), 'Missing demo student pass route 1000.');
    const routeStopRows = [];
    for (const direction of directions) {
      const directionId = directionIdByKey.get(`${direction.routeCode}\u0000${direction.direction}`);
      assert.ok(directionId, `Missing database direction for ${direction.routeCode} ${direction.direction}.`);
      direction.stops.forEach((stopName, index) => {
        const stopId = stopIdByName.get(stopName);
        assert.ok(stopId, `Missing stop record for ${stopName}.`);
        routeStopRows.push([directionId, stopId, index + 1]);
      });
    }
    await insertInChunks(
      connection,
      `INSERT INTO route_stops (route_direction_id, stop_id, sequence_number) VALUES`,
      routeStopRows,
      3,
      300,
      'ON DUPLICATE KEY UPDATE stop_id = VALUES(stop_id)',
    );

    for (const conductor of conductorData.conductors) {
      await connection.execute(
        `INSERT INTO conductors (employee_number, full_name, email, password_hash, is_active)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name),
           email = VALUES(email), password_hash = VALUES(password_hash), is_active = TRUE`,
        [conductor.employeeNumber, conductor.fullName, conductor.email, conductorPasswordHash],
      );
      await connection.execute(
        `INSERT INTO buses (registration_number, is_active)
         VALUES (?, TRUE)
         ON DUPLICATE KEY UPDATE is_active = TRUE`,
        [conductor.busRegistrationNumber],
      );

      const [conductorRows] = await connection.execute(
        'SELECT conductor_id FROM conductors WHERE email = ? LIMIT 1',
        [conductor.email],
      );
      const [busRows] = await connection.execute(
        'SELECT bus_id FROM buses WHERE registration_number = ? LIMIT 1',
        [conductor.busRegistrationNumber],
      );
      const directionId = directionIdByKey.get(`${conductor.routeCode}\u0000${conductor.direction}`);
      const conductorId = Number(conductorRows[0]?.conductor_id);
      const busId = Number(busRows[0]?.bus_id);
      assert.ok(directionId && conductorId && busId, 'Could not resolve demo conductor assignment records.');

      await connection.execute(
        `INSERT INTO trips
           (trip_code, bus_id, conductor_id, route_direction_id, current_stop_sequence, status, started_at, current_stop_updated_at)
         VALUES (?, ?, ?, ?, 1, 'running', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE bus_id = VALUES(bus_id), conductor_id = VALUES(conductor_id),
           route_direction_id = VALUES(route_direction_id), current_stop_sequence = 1,
           status = 'running', started_at = CURRENT_TIMESTAMP, current_stop_updated_at = CURRENT_TIMESTAMP`,
        [conductor.tripCode, busId, conductorId, directionId],
      );
    }

    for (const student of studentData.students) {
      await connection.execute(
        `INSERT INTO passengers (full_name, email, password_hash, is_active)
         VALUES (?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name), password_hash = VALUES(password_hash), is_active = TRUE`,
        [student.fullName, student.email, passwordHash],
      );
    }

    const studentEmails = studentData.students.map((student) => student.email);
    const emailMarkers = studentEmails.map(() => '?').join(',');
    const [passengerRows] = await connection.execute(
      `SELECT passenger_id, email FROM passengers WHERE email IN (${emailMarkers})`,
      studentEmails,
    );
    const passengerIdByEmail = new Map(passengerRows.map((row) => [row.email, Number(row.passenger_id)]));

    for (const student of studentData.students) {
      const passengerId = passengerIdByEmail.get(student.email);
      assert.ok(passengerId, `Missing seeded passenger account for ${student.email}.`);
      await connection.execute(
        `INSERT INTO student_passes
           (passenger_id, pass_public_id, route_code, pass_number, institution_name, valid_from, valid_until, status, verification_source, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END)
         ON DUPLICATE KEY UPDATE
           passenger_id = VALUES(passenger_id), route_code = VALUES(route_code),
           institution_name = VALUES(institution_name),
           valid_from = VALUES(valid_from), valid_until = VALUES(valid_until),
           status = VALUES(status), verification_source = VALUES(verification_source),
           verified_at = VALUES(verified_at)`,
        [passengerId, randomUUID(), demoPassRouteCode, student.passNumber, student.institutionName, student.validFrom, student.validUntil,
          student.status, student.verificationSource, student.status],
      );
    }

    const scheduleCode = 'BMTC-ORDINARY-USER-CHART-1';
    await connection.execute(
      `INSERT INTO fare_schedules
       (schedule_code, service_type, currency, source_label, effective_date_text, stage_basis_text, source_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'user_provided', TRUE)
       ON DUPLICATE KEY UPDATE service_type = VALUES(service_type), currency = VALUES(currency),
         source_label = VALUES(source_label), effective_date_text = VALUES(effective_date_text),
         stage_basis_text = VALUES(stage_basis_text),
         source_status = 'user_provided', is_active = TRUE`,
      [scheduleCode, fareData.serviceType, fareData.currency, fareData.sourceTitle, fareData.effectiveDateText, fareData.stageBasisText],
    );
    const [scheduleRows] = await connection.execute(
      'SELECT fare_schedule_id FROM fare_schedules WHERE schedule_code = ? LIMIT 1',
      [scheduleCode],
    );
    const scheduleId = Number(scheduleRows[0]?.fare_schedule_id);
    assert.ok(scheduleId, 'Could not find the seeded ordinary fare schedule.');
    await connection.execute(
      `INSERT INTO fare_rates
         (fare_schedule_id, chargeable_stages, distance_km, adult_fare, child_fare, senior_fare)
       VALUES ${placeholders(fareData.rates.length, 6)}
       ON DUPLICATE KEY UPDATE distance_km = VALUES(distance_km), adult_fare = VALUES(adult_fare),
         child_fare = VALUES(child_fare), senior_fare = VALUES(senior_fare)`,
      fareData.rates.flatMap((rate) => [scheduleId, rate.stage, rate.distanceKm, rate.adult, rate.child, rate.senior]),
    );

    await connection.commit();
    console.log(`Seeded ${routeData.routes.length} route codes, ${directions.length} directions, ${uniqueStopNames.length} stops, ${studentData.students.length} synthetic student accounts, ${conductorData.conductors.length} demo conductor assignment, and ${fareData.rates.length} ordinary fare stages.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await seedDatabase();
  } finally {
    await pool.end();
  }
}
