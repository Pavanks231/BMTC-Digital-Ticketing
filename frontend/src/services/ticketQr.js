const TICKET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePassengerTicketQrValue(value) {
  if (typeof value !== 'string' || value.length > 120) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'bmtc:' || parsed.hostname !== 'ticket'
      || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
      return null;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return null;
    const publicId = decodeURIComponent(segments[0]).toLowerCase();
    return TICKET_ID_PATTERN.test(publicId) ? publicId : null;
  } catch {
    return null;
  }
}
