import { normalizePublicTicketId } from './ticketValidation.js';

export function normalizeTicketVerification(input = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return normalizePublicTicketId(body.publicId);
}
