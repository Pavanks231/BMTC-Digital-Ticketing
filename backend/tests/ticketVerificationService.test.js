import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determineTicketVerificationResult,
  verifyTicketForConductor,
} from '../services/ticketVerificationService.js';

function fakeConnection() {
  return {
    calls: [],
    async beginTransaction() { this.calls.push('begin'); },
    async commit() { this.calls.push('commit'); },
    async rollback() { this.calls.push('rollback'); },
    release() { this.calls.push('release'); },
  };
}

const activeTrip = { id: 45, code: 'DEMO-TRIP-001' };

test('verification accepts only a valid, unused ticket for the conductor active trip', () => {
  assert.equal(determineTicketVerificationResult(activeTrip, { tripId: 45, status: 'valid' }), 'accepted');
  assert.equal(determineTicketVerificationResult(null, { tripId: 45, status: 'valid' }), 'no_active_trip');
  assert.equal(determineTicketVerificationResult(activeTrip, null), 'not_found');
  assert.equal(determineTicketVerificationResult(activeTrip, { tripId: 44, status: 'valid' }), 'wrong_trip');
  assert.equal(determineTicketVerificationResult(activeTrip, { tripId: 45, status: 'used' }), 'already_used');
  assert.equal(determineTicketVerificationResult(activeTrip, { tripId: 45, status: 'cancelled' }), 'not_valid');
});

test('ticket verification consumes and records a valid ticket in one transaction', async () => {
  const connection = fakeConnection();
  const events = [];
  const ticket = { id: 9, tripId: activeTrip.id, status: 'valid' };
  const result = await verifyTicketForConductor(7, '550e8400-e29b-41d4-a716-446655440000', {
    pool: { async getConnection() { return connection; } },
    async findActiveTrip() { return activeTrip; },
    async findTicket() { return ticket; },
    async markTicketUsed() { ticket.status = 'used'; return 1; },
    async recordVerification(_connection, event) { events.push(event); },
    async findTicketDetails() { return { reference: '550E8400', status: 'used' }; },
  });

  assert.deepEqual(connection.calls, ['begin', 'commit', 'release']);
  assert.equal(result.result, 'accepted');
  assert.equal(result.accepted, true);
  assert.deepEqual(events, [{
    publicId: '550e8400-e29b-41d4-a716-446655440000',
    ticketId: 9,
    conductorId: 7,
    tripId: 45,
    result: 'accepted',
  }]);
});

test('a duplicate scan is recorded but cannot consume an already-used ticket again', async () => {
  const connection = fakeConnection();
  const events = [];
  let consumeCalled = false;
  const result = await verifyTicketForConductor(7, '550e8400-e29b-41d4-a716-446655440000', {
    pool: { async getConnection() { return connection; } },
    async findActiveTrip() { return activeTrip; },
    async findTicket() { return { id: 9, tripId: activeTrip.id, status: 'used' }; },
    async markTicketUsed() { consumeCalled = true; return 0; },
    async recordVerification(_connection, event) { events.push(event); },
  });

  assert.equal(result.result, 'already_used');
  assert.equal(result.accepted, false);
  assert.equal(consumeCalled, false);
  assert.equal(events[0].result, 'already_used');
  assert.deepEqual(connection.calls, ['begin', 'commit', 'release']);
});

test('a database error rolls the verification transaction back', async () => {
  const connection = fakeConnection();
  await assert.rejects(verifyTicketForConductor(7, '550e8400-e29b-41d4-a716-446655440000', {
    pool: { async getConnection() { return connection; } },
    async findActiveTrip() { throw new Error('database failure'); },
  }), /database failure/);
  assert.deepEqual(connection.calls, ['begin', 'rollback', 'release']);
});
