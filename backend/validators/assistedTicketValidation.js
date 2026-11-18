const PASS_PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAssistedTicketRequest(input = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const studentPassPublicId = typeof body.studentPassPublicId === 'string'
    ? body.studentPassPublicId.trim().toLowerCase()
    : '';
  const destinationStopSequence = body.destinationStopSequence;
  const errors = [];

  if (!PASS_PUBLIC_ID_PATTERN.test(studentPassPublicId)) {
    errors.push('Scan a valid BMTC student pass QR code.');
  }
  if (!Number.isInteger(destinationStopSequence) || destinationStopSequence < 1 || destinationStopSequence > 65_535) {
    errors.push('Choose a valid destination stop.');
  }

  return { value: { studentPassPublicId, destinationStopSequence }, errors };
}
