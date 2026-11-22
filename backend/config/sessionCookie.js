const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
const isProduction = process.env.NODE_ENV === 'production';

if (!['lax', 'strict', 'none'].includes(COOKIE_SAME_SITE)) {
  throw new Error('COOKIE_SAME_SITE must be lax, strict, or none.');
}

if (COOKIE_SAME_SITE === 'none' && !isProduction) {
  throw new Error('COOKIE_SAME_SITE=none requires NODE_ENV=production so cookies use Secure.');
}

export function sessionCookieOptions(path, maxAge) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: COOKIE_SAME_SITE,
    ...(maxAge ? { maxAge } : {}),
    path,
  };
}
