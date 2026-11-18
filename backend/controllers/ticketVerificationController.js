import { listConductorTicketVerifications } from '../models/TicketVerification.js';
import { verifyTicketForConductor } from '../services/ticketVerificationService.js';
import { normalizeTicketVerification } from '../validators/ticketVerificationValidation.js';

export async function verifyConductorTicket(req, res, next) {
  const { value, errors } = normalizeTicketVerification(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const verification = await verifyTicketForConductor(req.auth.conductorId, value.publicId);
    return res.json({ verification });
  } catch (error) {
    return next(error);
  }
}

export async function getConductorTicketVerificationHistory(req, res, next) {
  try {
    const verifications = await listConductorTicketVerifications(req.auth.conductorId);
    return res.json({ verifications });
  } catch (error) {
    return next(error);
  }
}
