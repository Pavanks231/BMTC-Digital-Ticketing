import test from 'node:test';
import assert from 'node:assert/strict';
import fareData from '../database/data/ordinary_fare_chart.json' with { type: 'json' };
import { calculateFare, chargeableStagesForStopIntervals } from '../services/fareCalculator.js';

const ratesByStage = new Map(fareData.rates.map((rate) => [rate.stage, rate]));

test('fare chart data transcribes all 30 stages from the supplied image', () => {
  assert.equal(fareData.rates.length, 30);
  assert.deepEqual(fareData.rates[0], { stage: 1, distanceKm: 2, adult: 10, child: 5, senior: 8 });
  assert.deepEqual(fareData.rates[29], { stage: 30, distanceKm: 60, adult: 45, child: 23, senior: 34 });
  assert.equal(fareData.effectiveDateText, '04/05-11-2026');
  assert.equal(fareData.stopIntervalsPerStage, 3);
});

test('three traveled stop intervals make one 2 km fare stage, rounded upward', () => {
  assert.equal(chargeableStagesForStopIntervals(1), 1);
  assert.equal(chargeableStagesForStopIntervals(3), 1);
  assert.equal(chargeableStagesForStopIntervals(4), 2);
  assert.equal(chargeableStagesForStopIntervals(90), 30);
});

test('calculator applies adult, child, and senior rates by passenger count', () => {
  const result = calculateFare({
    stopIntervalCount: 4,
    ratesByStage,
    passengerCounts: [
      { category: 'general', count: 2 },
      { category: 'child', count: 1 },
      { category: 'senior_citizen', count: 1 },
    ],
  });

  assert.equal(result.chargeableStages, 2);
  assert.equal(result.estimatedDistanceKm, 4);
  assert.equal(result.total, 59);
  assert.equal(result.currency, 'INR');
});

test('verified student pass holders travel at no per-ride fare', () => {
  const result = calculateFare({
    stopIntervalCount: 2,
    ratesByStage,
    studentPassVerifiedCount: 1,
    passengerCounts: [
      { category: 'student', count: 1 },
      { category: 'general', count: 1 },
    ],
  });

  assert.equal(result.lineItems[0].subtotal, 0);
  assert.equal(result.total, 10);
});

test('students without a verified pass are charged the adult rate', () => {
  const result = calculateFare({
    stopIntervalCount: 1,
    ratesByStage,
    passengerCounts: [{ category: 'student', count: 1 }],
  });

  assert.equal(result.lineItems[0].billableCount, 1);
  assert.equal(result.total, 10);
});

test('calculator rejects reverse or same-stop journeys and journeys beyond the chart', () => {
  assert.throws(() => chargeableStagesForStopIntervals(0), /after the boarding stop/);
  assert.throws(() => chargeableStagesForStopIntervals(-1), /after the boarding stop/);
  assert.throws(() => chargeableStagesForStopIntervals(91), /30 chargeable stages/);
});
