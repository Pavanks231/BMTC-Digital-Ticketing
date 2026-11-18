import test from 'node:test';
import assert from 'node:assert/strict';
import { createFareQuote, FareQuoteError } from '../services/fareQuoteService.js';

const context = {
  bus: { registration_number: 'TEST-BUS-001' },
  trip: {
    id: 55,
    routeDirectionId: 77,
    code: 'DEMO-TRIP-001',
    currentStopSequence: 2,
    routeCode: '1000',
    routeName: 'Sample Route',
    direction: 'Outbound',
  },
  stops: [
    { sequence: 1, name: 'Start' },
    { sequence: 2, name: 'Boarding stop' },
    { sequence: 3, name: 'Middle stop' },
    { sequence: 4, name: 'Destination' },
  ],
};
const fareSchedule = {
  schedule: { id: 3, code: 'SAMPLE', sourceLabel: 'Sample fares', effectiveDateText: null, sourceStatus: 'demo', currency: 'INR' },
  ratesByStage: new Map([[1, { adult: 10, child: 5, senior: 8 }]]),
};
function dependencies({ tripContext = context, validPass = false, rates = fareSchedule } = {}) {
  return {
    findBusFareQuoteContext: async () => tripContext,
    findActiveOrdinaryFareRates: async () => rates,
    findCurrentVerifiedStudentPass: async (_passengerId, routeCode) => (
      validPass && routeCode === '1000' ? { id: 88 } : null
    ),
  };
}

test('fare quote derives route distance and applies only a verified account pass', async () => {
  const quote = await createFareQuote({
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 4,
    passengerId: 12,
    passengerCounts: [
      { category: 'student', count: 2 },
      { category: 'senior_citizen', count: 1 },
    ],
  }, dependencies({ validPass: true }));

  assert.equal(quote.bus.registrationNumber, 'TEST-BUS-001');
  assert.equal(quote.boardingStop.name, 'Boarding stop');
  assert.equal(quote.destinationStop.name, 'Destination');
  assert.equal(quote.fare.stopIntervalCount, 2);
  assert.equal(quote.fare.lineItems[0].verifiedPassCount, 1);
  assert.equal(quote.fare.lineItems[0].billableCount, 1);
  assert.equal(quote.fare.total, 18);
  assert.equal(quote.ticketRecord.studentPassId, 88);
});

test('students without a verified pass are charged the adult fare', async () => {
  const quote = await createFareQuote({
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 3,
    passengerId: 18,
    passengerCounts: [{ category: 'student', count: 1 }],
  }, dependencies());

  assert.equal(quote.fare.lineItems[0].verifiedPassCount, 0);
  assert.equal(quote.fare.total, 10);
  assert.equal(quote.ticketRecord.studentPassId, null);
});

test('a verified student pass does not apply to a different route', async () => {
  const differentRouteContext = {
    ...context,
    trip: { ...context.trip, routeCode: '1001' },
  };
  const quote = await createFareQuote({
    registrationNumber: 'TEST-BUS-001',
    destinationStopSequence: 3,
    passengerId: 18,
    passengerCounts: [{ category: 'student', count: 1 }],
  }, dependencies({ tripContext: differentRouteContext, validPass: true }));

  assert.equal(quote.fare.lineItems[0].verifiedPassCount, 0);
  assert.equal(quote.fare.total, 10);
  assert.equal(quote.ticketRecord.studentPassId, null);
});

test('fare quote rejects buses without trips and destinations not ahead on the route', async () => {
  await assert.rejects(
    createFareQuote({ registrationNumber: 'TEST-BUS-001', destinationStopSequence: 3, passengerId: 1, passengerCounts: [{ category: 'general', count: 1 }] }, dependencies({ tripContext: { bus: context.bus, trip: null, stops: [] } })),
    (error) => error instanceof FareQuoteError && error.status === 409,
  );
  await assert.rejects(
    createFareQuote({ registrationNumber: 'TEST-BUS-001', destinationStopSequence: 1, passengerId: 1, passengerCounts: [{ category: 'general', count: 1 }] }, dependencies()),
    (error) => error instanceof FareQuoteError && error.status === 422,
  );
});
