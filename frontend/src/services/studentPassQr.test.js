import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentPassQrValue } from './studentPassQr.js';

const passId = '550e8400-e29b-41d4-a716-446655440000';

test('student pass QR parsing returns only the opaque pass identifier', () => {
  assert.equal(parseStudentPassQrValue(`bmtc://student-pass/${passId}`), passId);
});

test('student pass QR parsing rejects ticket codes, extra data, and malformed identifiers', () => {
  for (const value of [
    `bmtc://ticket/${passId}`,
    `https://student-pass/${passId}`,
    `bmtc://student-pass/${passId}?route=1000`,
    `bmtc://student-pass/${passId}/extra`,
    'bmtc://student-pass/DEMO-PASS-2026-001',
    `bmtc://user@student-pass/${passId}`,
    'x'.repeat(121),
  ]) {
    assert.equal(parseStudentPassQrValue(value), null, value);
  }
});
