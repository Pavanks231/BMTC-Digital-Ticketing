import { pool } from '../config/database.js';
import {
  findConductorAssistedTripForUpdate,
  findStudentPassForAssistedTicket,
} from '../models/AssistedTicket.js';
import { createFareQuote, FareQuoteError } from './fareQuoteService.js';
import { persistQuotedTicket } from './ticketService.js';

export async function issueAssistedStudentTicket(
  conductorId,
  { studentPassPublicId, destinationStopSequence },
  dependencies = {},
) {
  const databasePool = dependencies.pool ?? pool;
  const loadTrip = dependencies.findConductorAssistedTrip ?? findConductorAssistedTripForUpdate;
  const loadPass = dependencies.findStudentPass ?? findStudentPassForAssistedTicket;
  const buildQuote = dependencies.createFareQuote ?? createFareQuote;
  const saveTicket = dependencies.persistQuotedTicket ?? persistQuotedTicket;
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();
    const activeTrip = await loadTrip(connection, conductorId);
    if (!activeTrip) throw new FareQuoteError('There is no running trip assigned to this conductor.', 409);
    if (activeTrip.currentStopSequence === null) {
      throw new FareQuoteError('Set the current boarding stop before issuing an assisted ticket.', 409);
    }

    const studentPass = await loadPass(connection, studentPassPublicId);
    if (!studentPass?.isValid) {
      throw new FareQuoteError('This student pass could not be verified or has expired.', 422);
    }
    if (!studentPass.routeCode || studentPass.routeCode !== activeTrip.routeCode) {
      const passRoute = studentPass.routeCode
        ? `${studentPass.routeCode}${studentPass.routeName ? ` (${studentPass.routeName})` : ''}`
        : 'a different or unassigned route';
      throw new FareQuoteError(
        `This student pass is valid for ${passRoute}, not route ${activeTrip.routeCode}.`,
        422,
      );
    }

    const quote = await buildQuote({
      passengerId: studentPass.passengerId,
      registrationNumber: activeTrip.busRegistrationNumber,
      destinationStopSequence,
      passengerCounts: [{ category: 'student', count: 1 }],
    }, {
      executor: connection,
      lockActiveTrip: true,
    });

    if (quote.ticketRecord.tripId !== activeTrip.id) {
      throw new FareQuoteError('The bus active trip changed. Refresh the conductor dashboard and retry.', 409);
    }
    if (quote.ticketRecord.studentPassId !== studentPass.id
      || quote.fare.lineItems[0]?.verifiedPassCount !== 1
      || quote.fare.total !== 0) {
      throw new FareQuoteError('The student pass is no longer eligible for this ticket.', 422);
    }

    const publicId = await saveTicket(connection, {
      passengerId: studentPass.passengerId,
      quote,
    }, dependencies);
    await connection.commit();
    return { publicId, passengerId: studentPass.passengerId };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new FareQuoteError('This student pass already has a ticket for this trip.', 409);
    }
    throw error;
  } finally {
    connection.release();
  }
}
