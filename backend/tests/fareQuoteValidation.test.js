import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFareQuote } from '../validators/fareQuoteValidation.js';

test('fare quote validation accepts destination and distinct supported passenger categories', () => {
  const result = normalizeFareQuote({
    destinationStopSequence: 8,
    passengerCounts: [
      { category: 'general', count: 1 },
      { category: 'senior_citizen', count: 2 },
      { category: 'student', count: 1 },
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    destinationStopSequence: 8,
    passengerCounts: [
      { category: 'general', count: 1 },
      { category: 'senior_citizen', count: 2 },
      { category: 'student', count: 1 },
    ],
  });
});

test('fare quote validation rejects invalid destination, categories, counts, and oversized groups', () => {
  assert.ok(normalizeFareQuote({ destinationStopSequence: '2', passengerCounts: [{ category: 'general', count: 1 }] }).errors.length);
  assert.ok(normalizeFareQuote({ destinationStopSequence: 0, passengerCounts: [{ category: 'general', count: 1 }] }).errors.length);
  assert.ok(normalizeFareQuote({ destinationStopSequence: 2, passengerCounts: [{ category: 'unknown', count: 1 }] }).errors.length);
  assert.ok(normalizeFareQuote({ destinationStopSequence: 2, passengerCounts: [{ category: 'general', count: 0 }] }).errors.length);
  assert.ok(normalizeFareQuote({ destinationStopSequence: 2, passengerCounts: [{ category: 'general', count: 1 }, { category: 'general', count: 1 }] }).errors.length);
  assert.ok(normalizeFareQuote({ destinationStopSequence: 2, passengerCounts: [{ category: 'general', count: 50 }, { category: 'child', count: 1 }] }).errors.length);
  assert.ok(normalizeFareQuote(null).errors.length);
});

test('client supplied fare and student pass claims are not part of normalized quote data', () => {
  const result = normalizeFareQuote({
    destinationStopSequence: 2,
    fare: 0,
    studentPassVerifiedCount: 50,
    passengerCounts: [{ category: 'student', count: 1 }],
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    destinationStopSequence: 2,
    passengerCounts: [{ category: 'student', count: 1 }],
  });
});
