const MAX_PASSENGERS = 50;
const CATEGORY_SET = new Set(['general', 'child', 'senior_citizen', 'student']);

export function normalizeFareQuote(input = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = [];
  const destinationStopSequence = body.destinationStopSequence;
  const rawCounts = body.passengerCounts;

  if (!Number.isInteger(destinationStopSequence) || destinationStopSequence < 1 || destinationStopSequence > 65_535) {
    errors.push('Choose a valid destination stop.');
  }

  if (!Array.isArray(rawCounts) || rawCounts.length < 1 || rawCounts.length > CATEGORY_SET.size) {
    errors.push('Choose at least one passenger category and count.');
    return { value: { destinationStopSequence, passengerCounts: [] }, errors };
  }

  const categories = new Set();
  const passengerCounts = [];
  let totalPassengers = 0;
  for (const item of rawCounts) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push('Each passenger count must include a category and count.');
      continue;
    }
    const { category, count } = item;
    if (!CATEGORY_SET.has(category)) {
      errors.push('Choose a supported passenger category.');
      continue;
    }
    if (categories.has(category)) {
      errors.push('Each passenger category can appear only once.');
      continue;
    }
    categories.add(category);
    if (!Number.isInteger(count) || count < 1 || count > MAX_PASSENGERS) {
      errors.push('Each passenger count must be a whole number from 1 to 50.');
      continue;
    }
    totalPassengers += count;
    passengerCounts.push({ category, count });
  }

  if (totalPassengers > MAX_PASSENGERS) {
    errors.push('A fare estimate can include at most 50 passengers.');
  }

  return { value: { destinationStopSequence, passengerCounts }, errors };
}
