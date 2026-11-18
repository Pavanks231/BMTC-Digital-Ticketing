const BUS_REGISTRATION_PATTERN = /^[a-zA-Z0-9._-]{1,32}$/;

export function createStaticBusQrValue(registrationNumber) {
  const value = typeof registrationNumber === 'string' ? registrationNumber.trim() : '';
  if (!BUS_REGISTRATION_PATTERN.test(value)) {
    throw new Error('A valid bus registration number is required.');
  }
  return `bmtc://bus/${encodeURIComponent(value)}`;
}

export function parseStaticBusQrValue(value) {
  if (typeof value !== 'string' || value.length > 100) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'bmtc:' || parsed.hostname !== 'bus'
      || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
      return null;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return null;
    const registrationNumber = decodeURIComponent(segments[0]);
    return BUS_REGISTRATION_PATTERN.test(registrationNumber) ? registrationNumber : null;
  } catch {
    return null;
  }
}
