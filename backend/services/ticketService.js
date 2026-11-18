import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { insertPassengerTicket } from '../models/Ticket.js';
import { createFareQuote, FareQuoteError } from './fareQuoteService.js';

export async function persistQuotedTicket(connection, { passengerId, quote }, dependencies = {}) {
  const saveTicket = dependencies.insertPassengerTicket ?? insertPassengerTicket;
  const publicId = randomUUID();
  await saveTicket(connection, {
    passengerId,
    publicId,
    quote,
    paymentStatus: quote.fare.total === 0 ? 'not_required' : 'not_integrated',
  });
  return publicId;
}

export async function issuePassengerTicket(
  { passengerId, registrationNumber, destinationStopSequence, passengerCounts },
  dependencies = {},
) {
  const databasePool = dependencies.pool ?? pool;
  const buildQuote = dependencies.createFareQuote ?? createFareQuote;
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const quote = await buildQuote({
      passengerId,
      registrationNumber,
      destinationStopSequence,
      passengerCounts,
    }, {
      executor: connection,
      lockActiveTrip: true,
    });
    const publicId = await persistQuotedTicket(connection, { passengerId, quote }, dependencies);
    await connection.commit();
    return publicId;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new FareQuoteError('This verified student pass already has a ticket for this trip.', 409);
    }
    throw error;
  } finally {
    connection.release();
  }
}
