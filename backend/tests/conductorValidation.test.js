import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStopUpdate } from '../validators/conductorValidation.js';

test('current stop update accepts a positive integer sequence', () => {
  const result = normalizeStopUpdate({ sequenceNumber: 7 });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { sequenceNumber: 7 });
});

test('current stop update rejects missing, fractional, string, and out-of-range values', () => {
  for (const sequenceNumber of [undefined, 0, -1, 1.5, '2', 65_536]) {
    assert.equal(normalizeStopUpdate({ sequenceNumber }).errors.length, 1);
  }
});
