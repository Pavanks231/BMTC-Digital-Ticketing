import { pool } from '../config/database.js';
import {
  findConductorActiveTripForUpdate,
  findTicketForUpdate,
  findVerifiedTicketDetails,
  markTicketUsed,
  recordTicketVerification,
} from '../models/TicketVerification.js';

const RESULT_MESSAGES = Object.freeze({
  accepted: 'Ticket is valid and has been marked used.',
  already_used: 'This ticket has already been used.',
  wrong_trip: 'This ticket belongs to a different trip.',
  not_valid: 'This ticket is cancelled or is no longer valid.',
  not_found: 'No ticket was found for this QR identifier.',
  no_active_trip: 'There is no active trip assigned to this conductor.',
});

export function determineTicketVerificationResult(activeTrip, ticket) {
  if (!activeTrip) return 'no_active_trip';
  if (!ticket) return 'not_found';
  if (ticket.tripId !== activeTrip.id) return 'wrong_trip';
  if (ticket.status === 'used') return 'already_used';
  if (ticket.status !== 'valid') return 'not_valid';
  return 'accepted';
}

export async function verifyTicketForConductor(conductorId, publicId, dependencies = {}) {
  const databasePool = dependencies.pool ?? pool;
  const findActiveTrip = dependencies.findActiveTrip ?? findConductorActiveTripForUpdate;
  const loadTicket = dependencies.findTicket ?? findTicketForUpdate;
  const consumeTicket = dependencies.markTicketUsed ?? markTicketUsed;
  const recordVerification = dependencies.recordVerification ?? recordTicketVerification;
  const loadTicketDetails = dependencies.findTicketDetails ?? findVerifiedTicketDetails;
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();
    const activeTrip = await findActiveTrip(connection, conductorId);
    const ticket = activeTrip ? await loadTicket(connection, publicId) : null;
    let result = determineTicketVerificationResult(activeTrip, ticket);

    if (result === 'accepted') {
      const affectedRows = await consumeTicket(connection, ticket.id);
      if (affectedRows !== 1) {
        const currentTicket = await loadTicket(connection, publicId);
        result = currentTicket?.status === 'used' ? 'already_used' : 'not_valid';
      }
    }

    await recordVerification(connection, {
      publicId,
      ticketId: ticket?.id ?? null,
      conductorId,
      tripId: activeTrip?.id ?? null,
      result,
    });

    const ticketDetails = result === 'accepted'
      ? await loadTicketDetails(connection, ticket.id)
      : null;
    await connection.commit();

    return {
      result,
      accepted: result === 'accepted',
      message: RESULT_MESSAGES[result],
      ticket: ticketDetails,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
