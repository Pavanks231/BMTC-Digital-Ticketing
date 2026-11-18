import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDirection,
  normalizeBusRegistration,
  normalizeRouteCode,
  normalizeRouteSearch,
} from '../validators/transitValidation.js';

test('route search trims and collapses whitespace', () => {
  const result = normalizeRouteSearch('  Kempegowda   Bus Station  ');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { search: 'Kempegowda Bus Station' });
});

test('route search rejects repeated values, long input, and control characters', () => {
  assert.equal(normalizeRouteSearch(['1000']).errors.length, 1);
  assert.equal(normalizeRouteSearch('a'.repeat(81)).errors.length, 1);
  assert.equal(normalizeRouteSearch('1000\nOutbound').errors.length, 1);
});

test('route code validation accepts workbook codes and rejects unsafe path values', () => {
  assert.deepEqual(normalizeRouteCode(' 1000 ').value, { routeCode: '1000' });
  assert.deepEqual(normalizeRouteCode('1000/../../buses').errors, ['Enter a valid route code.']);
});

test('direction validation normalizes inbound and outbound names', () => {
  assert.deepEqual(normalizeDirection(' outbound ').value, { direction: 'Outbound' });
  assert.deepEqual(normalizeDirection('INBOUND').value, { direction: 'Inbound' });
  assert.equal(normalizeDirection('north').errors.length, 1);
});

test('bus registration validation accepts the static QR identifier and rejects path injection', () => {
  assert.deepEqual(normalizeBusRegistration(' TEST-BUS-001 ').value, { registrationNumber: 'TEST-BUS-001' });
  assert.equal(normalizeBusRegistration('../other').errors.length, 1);
});
