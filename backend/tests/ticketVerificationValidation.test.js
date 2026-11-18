import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTicketVerification } from '../validators/ticketVerificationValidation.js';

test('ticket verification accepts a normalized ticket UUID only', () => {
  const result = normalizeTicketVerification({ publicId: '550E8400-E29B-41D4-A716-446655440000' });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { publicId: '550e8400-e29b-41d4-a716-446655440000' });
});

test('ticket verification rejects bus codes, URLs, and malformed request bodies', () => {
  assert.equal(normalizeTicketVerification({ publicId: 'TEST-BUS-001' }).errors.length, 1);
  assert.equal(normalizeTicketVerification({ publicId: 'bmtc://ticket/550e8400-e29b-41d4-a716-446655440000' }).errors.length, 1);
  assert.equal(normalizeTicketVerification(null).errors.length, 1);
});
