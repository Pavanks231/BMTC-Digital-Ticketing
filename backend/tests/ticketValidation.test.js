import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublicTicketId, normalizeTicketRequest } from '../validators/ticketValidation.js';

test('ticket creation validates the bus, destination, and passenger counts', () => {
  const result = normalizeTicketRequest({
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 4,
    passengerCounts: [{ category: 'general', count: 1 }],
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 4,
    passengerCounts: [{ category: 'general', count: 1 }],
  });
});

test('ticket creation ignores client supplied fare, ticket id, and student pass claims', () => {
  const result = normalizeTicketRequest({
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 4,
    passengerCounts: [{ category: 'student', count: 1 }],
    fare: 0,
    publicId: '00000000-0000-4000-8000-000000000000',
    studentPassVerifiedCount: 1,
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 4,
    passengerCounts: [{ category: 'student', count: 1 }],
  });
});

test('ticket history IDs accept generated UUID v4 values and reject arbitrary values', () => {
  assert.deepEqual(
    normalizePublicTicketId('550e8400-e29b-41d4-a716-446655440000').errors,
    [],
  );
  assert.equal(
    normalizePublicTicketId('550E8400-E29B-41D4-A716-446655440000').value.publicId,
    '550e8400-e29b-41d4-a716-446655440000',
  );
  assert.equal(normalizePublicTicketId('bmtc://ticket/550e8400-e29b-41d4-a716-446655440000').errors.length, 1);
  assert.equal(normalizePublicTicketId('550e8400-e29b-11d4-a716-446655440000').errors.length, 1);
});
