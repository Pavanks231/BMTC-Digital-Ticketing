import { pool } from '../config/database.js';

export async function insertPassengerTicket(connection, { passengerId, publicId, quote, paymentStatus }) {
  const passengerTotal = quote.fare.lineItems.reduce((total, item) => total + item.count, 0);
  const [ticketResult] = await connection.execute(
    `INSERT INTO tickets
       (public_id, passenger_id, trip_id, route_direction_id,
        boarding_stop_sequence, destination_stop_sequence, fare_schedule_id,
        student_pass_id, passenger_total, fare_total, currency, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      passengerId,
      quote.ticketRecord.tripId,
      quote.ticketRecord.routeDirectionId,
      quote.ticketRecord.boardingStopSequence,
      quote.ticketRecord.destinationStopSequence,
      quote.ticketRecord.fareScheduleId,
      quote.ticketRecord.studentPassId,
      passengerTotal,
      quote.fare.total,
      quote.fare.currency,
      paymentStatus,
    ],
  );

  const items = quote.fare.lineItems;
  const valuesSql = items.map(() => '(?, ?, ?, ?, ?)').join(', ');
  await connection.execute(
    `INSERT INTO ticket_passenger_counts
       (ticket_id, category, passenger_count, verified_pass_count, subtotal)
     VALUES ${valuesSql}`,
    items.flatMap((item) => [
      ticketResult.insertId,
      item.category,
      item.count,
      item.verifiedPassCount || 0,
      item.subtotal,
    ]),
  );

  return Number(ticketResult.insertId);
}

async function loadPassengerTickets(passengerId, publicId) {
  const publicIdFilter = publicId ? 'AND t.public_id = ?' : '';
  const queryValues = publicId ? [passengerId, publicId] : [passengerId];
  const [rows] = await pool.execute(
    `SELECT t.ticket_id, t.public_id, t.status, t.payment_status, t.issued_at,
            t.fare_total, t.currency, t.passenger_total,
            t.boarding_stop_sequence, t.destination_stop_sequence,
            tr.trip_code, r.route_code, r.route_name, rd.direction_name,
            boarding_stop.stop_name AS boarding_stop_name,
            destination_stop.stop_name AS destination_stop_name,
            fs.source_label, fs.effective_date_text
       FROM tickets t
       JOIN trips tr ON tr.trip_id = t.trip_id
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
       JOIN fare_schedules fs ON fs.fare_schedule_id = t.fare_schedule_id
      WHERE t.passenger_id = ? ${publicIdFilter}
      ORDER BY t.issued_at DESC, t.ticket_id DESC
      LIMIT ${publicId ? 1 : 50}`,
    queryValues,
  );
  if (!rows.length) return [];

  const ticketIds = rows.map((row) => Number(row.ticket_id));
  const placeholders = ticketIds.map(() => '?').join(', ');
  const [itemRows] = await pool.execute(
    `SELECT ticket_id, category, passenger_count, verified_pass_count, subtotal
       FROM ticket_passenger_counts
      WHERE ticket_id IN (${placeholders})
      ORDER BY ticket_id ASC, category ASC`,
    ticketIds,
  );
  const itemsByTicketId = new Map(ticketIds.map((ticketId) => [ticketId, []]));
  for (const item of itemRows) {
    itemsByTicketId.get(Number(item.ticket_id))?.push({
      category: item.category,
      count: Number(item.passenger_count),
      verifiedPassCount: Number(item.verified_pass_count),
      subtotal: Number(item.subtotal),
    });
  }

  return rows.map((row) => {
    const publicTicketId = row.public_id;
    return {
      publicId: publicTicketId,
      reference: publicTicketId.slice(0, 8).toUpperCase(),
      qrValue: `bmtc://ticket/${publicTicketId}`,
      status: row.status,
      paymentStatus: row.payment_status,
      issuedAt: row.issued_at,
      trip: {
        code: row.trip_code,
        routeCode: row.route_code,
        routeName: row.route_name,
        direction: row.direction_name,
      },
      boardingStop: {
        sequence: Number(row.boarding_stop_sequence),
        name: row.boarding_stop_name,
      },
      destinationStop: {
        sequence: Number(row.destination_stop_sequence),
        name: row.destination_stop_name,
      },
      fare: {
        total: Number(row.fare_total),
        currency: row.currency,
        passengerCount: Number(row.passenger_total),
        lineItems: itemsByTicketId.get(Number(row.ticket_id)) || [],
      },
      fareSchedule: {
        sourceLabel: row.source_label,
        effectiveDateText: row.effective_date_text,
      },
    };
  });
}

export async function listPassengerTickets(passengerId) {
  return loadPassengerTickets(passengerId, null);
}

export async function findPassengerTicket(passengerId, publicId) {
  const [ticket] = await loadPassengerTickets(passengerId, publicId);
  return ticket ?? null;
}
