import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireConductor } from '../middleware/requireConductor.js';

const secret = 'conductor-middleware-test-secret-value-32';
process.env.JWT_SECRET = secret;

function callMiddleware(token) {
  const req = { cookies: token ? { bmtc_conductor_session: token } : {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let passed = false;
  requireConductor(req, res, () => { passed = true; });
  return { req, res, passed };
}

test('conductor dashboard middleware rejects requests without a session', () => {
  const result = callMiddleware(null);
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 401);
});

test('conductor dashboard middleware rejects passenger sessions', () => {
  const token = jwt.sign({ role: 'passenger' }, secret, { subject: '19' });
  const result = callMiddleware(token);
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 401);
});

test('conductor dashboard middleware accepts a conductor session and exposes its id', () => {
  const token = jwt.sign({ role: 'conductor' }, secret, { subject: '19' });
  const result = callMiddleware(token);
  assert.equal(result.passed, true);
  assert.deepEqual(result.req.auth, { conductorId: 19 });
});
