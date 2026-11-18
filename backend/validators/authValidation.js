const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRegistration(input = {}) {
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim().replace(/\s+/g, ' ') : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = [];

  if (fullName.length < 2 || fullName.length > 100) {
    errors.push('Enter a name between 2 and 100 characters.');
  }
  if (/[\u0000-\u001f\u007f]/.test(fullName)) {
    errors.push('The name contains unsupported characters.');
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push('Enter a valid email address.');
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    errors.push('Use a password between 8 and 72 UTF-8 bytes.');
  }

  return { value: { fullName, email, password }, errors };
}

export function normalizeLogin(input = {}) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = [];

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push('Enter a valid email address.');
  }
  if (!password || Buffer.byteLength(password, 'utf8') > 72) {
    errors.push('Enter your password.');
  }

  return { value: { email, password }, errors };
}
