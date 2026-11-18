import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePassengerTicketQrValue } from './ticketQr.js';

const ticketId = '550e8400-e29b-41d4-a716-446655440000';

test('ticket QR parsing returns only the UUID identifier', () => {
  assert.equal(parsePassengerTicketQrValue(`bmtc://ticket/${ticketId}`), ticketId);
});

test('ticket QR parsing rejects other schemes, hosts, extra data, and malformed IDs', () => {
  for (const value of [
    `https://ticket/${ticketId}`,
    `bmtc://bus/${ticketId}`,
    `bmtc://ticket/${ticketId}?fare=0`,
    `bmtc://ticket/${ticketId}/extra`,
    `bmtc://user@ticket/${ticketId}`,
    'bmtc://ticket/not-a-ticket-id',
    'x'.repeat(121),
  ]) {
    assert.equal(parsePassengerTicketQrValue(value), null, value);
  }
});
