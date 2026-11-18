const MAX_STOP_SEQUENCE = 65_535;

export function normalizeStopUpdate(input = {}) {
  const sequenceNumber = input.sequenceNumber;
  const errors = [];

  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > MAX_STOP_SEQUENCE) {
    errors.push('Choose a valid stop from the assigned route.');
  }

  return { value: { sequenceNumber }, errors };
}
