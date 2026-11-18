import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLogin, normalizeRegistration } from '../validators/authValidation.js';

test('registration trims the name and normalizes email', () => {
  const result = normalizeRegistration({
    fullName: '  Demo   Rider  ',
    email: ' RIDER@example.test ',
    password: 'SafePass!123',
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.fullName, 'Demo Rider');
  assert.equal(result.value.email, 'rider@example.test');
});

test('registration rejects a short password and malformed email', () => {
  const result = normalizeRegistration({ fullName: 'Rider', email: 'not-an-email', password: 'short' });
  assert.equal(result.errors.length, 2);
});

test('registration enforces bcrypt UTF-8 input limits', () => {
  const result = normalizeRegistration({ fullName: 'Rider', email: 'rider@example.test', password: 'a'.repeat(73) });
  assert.match(result.errors.join(' '), /72 UTF-8 bytes/);
});

test('login normalizes the email and leaves the password unchanged', () => {
  const result = normalizeLogin({ email: ' USER@example.test ', password: ' case-sensitive ' });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, { email: 'user@example.test', password: ' case-sensitive ' });
});
