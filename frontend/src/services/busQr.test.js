import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticBusQrValue, parseStaticBusQrValue } from './busQr.js';

test('static bus QR values contain only the public bus registration identifier', () => {
  const value = createStaticBusQrValue(' TEST-BUS-001 ');
  assert.equal(value, 'bmtc://bus/TEST-BUS-001');
  assert.equal(parseStaticBusQrValue(value), 'TEST-BUS-001');
});

test('bus QR parsing rejects other schemes, hosts, and extra URL data', () => {
  for (const value of [
    'https://bus/TEST-BUS-001',
    'bmtc://other/TEST-BUS-001',
    'bmtc://bus/TEST-BUS-001/extra',
    'bmtc://bus/TEST-BUS-001?fare=0',
    'bmtc://user@bus/TEST-BUS-001',
    'not a qr payload',
  ]) {
    assert.equal(parseStaticBusQrValue(value), null, value);
  }
});

test('static bus QR generation rejects invalid registration values', () => {
  assert.throws(() => createStaticBusQrValue('../other'));
  assert.equal(parseStaticBusQrValue('bmtc://bus/%2F%2F'), null);
});
