import test from 'node:test';
import assert from 'node:assert/strict';
import { issuePassengerTicket } from '../services/ticketService.js';

function fakeConnection() {
  return {
    calls: [],
    async beginTransaction() { this.calls.push('begin'); },
    async commit() { this.calls.push('commit'); },
    async rollback() { this.calls.push('rollback'); },
    release() { this.calls.push('release'); },
  };
}

test('ticket creation recalculates inside a transaction and commits the stored quote', async () => {
  const connection = fakeConnection();
  let saved;
  let quoteOptions;
  const quote = { fare: { total: 18 } };
  const publicId = await issuePassengerTicket({
    passengerId: 12,
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 5,
    passengerCounts: [{ category: 'general', count: 1 }],
  }, {
    pool: { async getConnection() { return connection; } },
    async createFareQuote(input, options) {
      quoteOptions = { input, options };
      return quote;
    },
    async insertPassengerTicket(conn, record) { saved = { conn, record }; },
  });

  assert.match(publicId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(connection.calls, ['begin', 'commit', 'release']);
  assert.equal(quoteOptions.input.passengerId, 12);
  assert.equal(quoteOptions.options.executor, connection);
  assert.equal(quoteOptions.options.lockActiveTrip, true);
  assert.equal(saved.conn, connection);
  assert.equal(saved.record.quote, quote);
  assert.equal(saved.record.publicId, publicId);
  assert.equal(saved.record.paymentStatus, 'not_integrated');
});

test('failed fare recalculation rolls back and does not insert a ticket', async () => {
  const connection = fakeConnection();
  let insertCalled = false;

  await assert.rejects(issuePassengerTicket({
    passengerId: 12,
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 5,
    passengerCounts: [{ category: 'general', count: 1 }],
  }, {
    pool: { async getConnection() { return connection; } },
    async createFareQuote() { throw new Error('Trip changed before ticket confirmation.'); },
    async insertPassengerTicket() { insertCalled = true; },
  }), /Trip changed/);

  assert.deepEqual(connection.calls, ['begin', 'rollback', 'release']);
  assert.equal(insertCalled, false);
});
