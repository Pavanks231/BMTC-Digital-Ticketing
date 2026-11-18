import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAssistedTicketRequest } from '../validators/assistedTicketValidation.js';

test('assisted booking accepts an opaque student pass QR ID and validates destination', () => {
  const result = normalizeAssistedTicketRequest({
    studentPassPublicId: '550E8400-E29B-41D4-A716-446655440000',
    destinationStopSequence: 4,
    fare: 0,
    passengerId: 999,
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    studentPassPublicId: '550e8400-e29b-41d4-a716-446655440000',
    destinationStopSequence: 4,
  });
});

test('assisted booking rejects invalid QR IDs and non-integer destinations', () => {
  assert.ok(normalizeAssistedTicketRequest({ studentPassPublicId: '../student', destinationStopSequence: 2 }).errors.length);
  assert.ok(normalizeAssistedTicketRequest({ studentPassPublicId: '550e8400-e29b-41d4-a716-446655440000', destinationStopSequence: '2' }).errors.length);
  assert.ok(normalizeAssistedTicketRequest(null).errors.length);
});
