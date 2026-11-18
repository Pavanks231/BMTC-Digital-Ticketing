const ROUTE_CODE_PATTERN = /^[a-zA-Z0-9._-]{1,32}$/;
const BUS_REGISTRATION_PATTERN = /^[a-zA-Z0-9._-]{1,32}$/;

export function normalizeRouteSearch(input) {
  const rawSearch = typeof input === 'string' ? input : '';
  const search = rawSearch.trim().replace(/\s+/g, ' ');
  const errors = [];

  if (input !== undefined && typeof input !== 'string') {
    errors.push('Route search must be a single text value.');
  } else if (/[\u0000-\u001f\u007f]/.test(rawSearch)) {
    errors.push('Route search contains unsupported characters.');
  } else if (search.length > 80) {
    errors.push('Route search must be 80 characters or fewer.');
  }

  return { value: { search }, errors };
}

export function normalizeRouteCode(input) {
  const routeCode = typeof input === 'string' ? input.trim() : '';
  const errors = ROUTE_CODE_PATTERN.test(routeCode) ? [] : ['Enter a valid route code.'];
  return { value: { routeCode }, errors };
}

export function normalizeBusRegistration(input) {
  const registrationNumber = typeof input === 'string' ? input.trim() : '';
  const errors = BUS_REGISTRATION_PATTERN.test(registrationNumber)
    ? []
    : ['Enter a valid bus registration number.'];
  return { value: { registrationNumber }, errors };
}

export function normalizeDirection(input) {
  const directionName = typeof input === 'string' ? input.trim().toLowerCase() : '';
  const direction = directionName === 'outbound' ? 'Outbound'
    : directionName === 'inbound' ? 'Inbound'
      : null;
  const errors = direction ? [] : ['Direction must be Inbound or Outbound.'];
  return { value: { direction }, errors };
}
