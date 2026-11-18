import { normalizeFareQuote } from './fareQuoteValidation.js';
import { normalizeBusRegistration } from './transitValidation.js';

const PUBLIC_TICKET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeTicketRequest(input = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const registration = normalizeBusRegistration(body.registrationNumber);
  const fareQuote = normalizeFareQuote(body);
  const errors = [...registration.errors, ...fareQuote.errors];
  return {
    value: {
      registrationNumber: registration.value.registrationNumber,
      ...fareQuote.value,
    },
    errors,
  };
}

export function normalizePublicTicketId(input) {
  const publicId = typeof input === 'string' ? input.trim().toLowerCase() : '';
  return {
    value: { publicId },
    errors: PUBLIC_TICKET_ID_PATTERN.test(publicId)
      ? []
      : ['Enter a valid ticket identifier.'],
  };
}
