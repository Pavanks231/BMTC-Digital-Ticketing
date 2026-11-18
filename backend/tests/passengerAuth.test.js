import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requirePassenger } from '../middleware/requirePassenger.js';

const secret = 'passenger-middleware-test-secret-value-32';
process.env.JWT_SECRET = secret;

function callMiddleware(token) {
  const req = { cookies: token ? { bmtc_session: token } : {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let passed = false;
  requirePassenger(req, res, () => { passed = true; });
  return { req, res, passed };
}

test('passenger middleware rejects missing sessions and conductor sessions', () => {
  assert.equal(callMiddleware(null).res.statusCode, 401);
  const conductorToken = jwt.sign({ role: 'conductor' }, secret, { subject: '17' });
  assert.equal(callMiddleware(conductorToken).res.statusCode, 401);
});

test('passenger middleware accepts a passenger session and exposes its id', () => {
  const token = jwt.sign({ role: 'passenger' }, secret, { subject: '23' });
  const result = callMiddleware(token);
  assert.equal(result.passed, true);
  assert.deepEqual(result.req.auth, { passengerId: 23 });
});
