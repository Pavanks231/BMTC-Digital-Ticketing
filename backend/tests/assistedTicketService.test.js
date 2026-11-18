import test from 'node:test';
import assert from 'node:assert/strict';
import { issueAssistedStudentTicket } from '../services/assistedTicketService.js';

function fakeConnection() {
  return {
    calls: [],
    async beginTransaction() { this.calls.push('begin'); },
    async commit() { this.calls.push('commit'); },
    async rollback() { this.calls.push('rollback'); },
    release() { this.calls.push('release'); },
  };
}

const activeTrip = {
  id: 45,
  busRegistrationNumber: 'TEST-BUS-001',
  currentStopSequence: 2,
  routeCode: '1000',
  direction: 'Outbound',
};

test('assisted booking verifies the pass and issues a zero-fare ticket on the conductor trip', async () => {
  const connection = fakeConnection();
  let quoteInput;
  let quoteOptions;
  let saved;
  const quote = {
    fare: { total: 0, lineItems: [{ category: 'student', count: 1, verifiedPassCount: 1 }] },
    ticketRecord: { tripId: 45, studentPassId: 88 },
  };
  const result = await issueAssistedStudentTicket(7, {
    studentPassPublicId: '550e8400-e29b-41d4-a716-446655440000',
    destinationStopSequence: 8,
  }, {
    pool: { async getConnection() { return connection; } },
    async findConductorAssistedTrip() { return activeTrip; },
    async findStudentPass() {
      return { id: 88, passengerId: 41, routeCode: '1000', isValid: true };
    },
    async createFareQuote(input, options) { quoteInput = input; quoteOptions = options; return quote; },
    async persistQuotedTicket(conn, ticket) { saved = { conn, ticket }; return '550e8400-e29b-41d4-a716-446655440000'; },
  });

  assert.deepEqual(connection.calls, ['begin', 'commit', 'release']);
  assert.equal(quoteInput.passengerId, 41);
  assert.equal(quoteInput.registrationNumber, 'TEST-BUS-001');
  assert.equal(quoteInput.destinationStopSequence, 8);
  assert.deepEqual(quoteInput.passengerCounts, [{ category: 'student', count: 1 }]);
  assert.equal(quoteOptions.executor, connection);
  assert.equal(quoteOptions.lockActiveTrip, true);
  assert.equal(saved.conn, connection);
  assert.equal(saved.ticket.passengerId, 41);
  assert.equal(saved.ticket.quote, quote);
  assert.deepEqual(result, { publicId: '550e8400-e29b-41d4-a716-446655440000', passengerId: 41 });
});

test('assisted booking refuses an invalid pass without creating a ticket', async () => {
  const connection = fakeConnection();
  let quoteCalled = false;

  await assert.rejects(issueAssistedStudentTicket(7, {
    studentPassPublicId: '550e8400-e29b-41d4-a716-446655440000',
    destinationStopSequence: 8,
  }, {
    pool: { async getConnection() { return connection; } },
    async findConductorAssistedTrip() { return activeTrip; },
    async findStudentPass() {
      return { id: 88, passengerId: 41, routeCode: '1000', isValid: false };
    },
    async createFareQuote() { quoteCalled = true; },
  }), /could not be verified or has expired/);

  assert.equal(quoteCalled, false);
  assert.deepEqual(connection.calls, ['begin', 'rollback', 'release']);
});

test('assisted booking refuses a pass when there is no active trip', async () => {
  const connection = fakeConnection();
  await assert.rejects(issueAssistedStudentTicket(7, {
    studentPassPublicId: '550e8400-e29b-41d4-a716-446655440000',
    destinationStopSequence: 8,
  }, {
    pool: { async getConnection() { return connection; } },
    async findConductorAssistedTrip() { return null; },
  }), /no running trip/);
  assert.deepEqual(connection.calls, ['begin', 'rollback', 'release']);
});

test('assisted booking refuses a verified pass assigned to another route', async () => {
  const connection = fakeConnection();
  let quoteCalled = false;
  await assert.rejects(issueAssistedStudentTicket(7, {
    studentPassPublicId: '550e8400-e29b-41d4-a716-446655440000',
    destinationStopSequence: 8,
  }, {
    pool: { async getConnection() { return connection; } },
    async findConductorAssistedTrip() { return activeTrip; },
    async findStudentPass() {
      return { id: 88, passengerId: 41, routeCode: '1001', routeName: 'Different Route', isValid: true };
    },
    async createFareQuote() { quoteCalled = true; },
  }), /valid for 1001 \(Different Route\), not route 1000/);
  assert.equal(quoteCalled, false);
  assert.deepEqual(connection.calls, ['begin', 'rollback', 'release']);
});
