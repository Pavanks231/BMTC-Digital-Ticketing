import { findPassengerTicket, listPassengerTickets } from '../models/Ticket.js';
import { FareQuoteError } from '../services/fareQuoteService.js';
import { issueAssistedStudentTicket } from '../services/assistedTicketService.js';
import { issuePassengerTicket } from '../services/ticketService.js';
import { normalizeAssistedTicketRequest } from '../validators/assistedTicketValidation.js';
import { normalizePublicTicketId, normalizeTicketRequest } from '../validators/ticketValidation.js';

export async function createTicket(req, res, next) {
  const { value, errors } = normalizeTicketRequest(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const publicId = await issuePassengerTicket({
      passengerId: req.auth.passengerId,
      ...value,
    });
    const ticket = await findPassengerTicket(req.auth.passengerId, publicId);
    if (!ticket) return res.status(500).json({ message: 'The ticket was created but could not be loaded.' });
    return res.status(201).json({ message: 'Demo ticket created.', ticket });
  } catch (error) {
    if (error instanceof FareQuoteError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

export async function createAssistedStudentTicket(req, res, next) {
  const { value, errors } = normalizeAssistedTicketRequest(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const issued = await issueAssistedStudentTicket(req.auth.conductorId, value);
    const ticket = await findPassengerTicket(issued.passengerId, issued.publicId);
    if (!ticket) return res.status(500).json({ message: 'The ticket was issued but could not be loaded.' });
    return res.status(201).json({ message: 'Assisted student ticket created.', ticket });
  } catch (error) {
    if (error instanceof FareQuoteError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

export async function getTicketHistory(req, res, next) {
  try {
    const tickets = await listPassengerTickets(req.auth.passengerId);
    return res.json({ tickets });
  } catch (error) {
    return next(error);
  }
}

export async function getTicketDetails(req, res, next) {
  const { value, errors } = normalizePublicTicketId(req.params.publicId);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const ticket = await findPassengerTicket(req.auth.passengerId, value.publicId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found in your passenger history.' });
    return res.json({ ticket });
  } catch (error) {
    return next(error);
  }
}
