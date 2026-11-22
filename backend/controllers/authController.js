import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sessionCookieOptions } from '../config/sessionCookie.js';
import {
  createPassenger,
  findPassengerByEmail,
  findPublicPassengerById,
} from '../models/Passenger.js';
import { normalizeLogin, normalizeRegistration } from '../validators/authValidation.js';

const COOKIE_NAME = 'bmtc_session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function setSessionCookie(res, passengerId) {
  const token = jwt.sign(
    { role: 'passenger' },
    process.env.JWT_SECRET,
    { subject: String(passengerId), expiresIn: process.env.JWT_EXPIRES_IN || '12h' },
  );

  res.cookie(COOKIE_NAME, token, sessionCookieOptions('/api', SESSION_MAX_AGE_MS));
}

export async function registerPassenger(req, res, next) {
  const { value, errors } = normalizeRegistration(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const passwordHash = await bcrypt.hash(value.password, 12);
    const passengerId = await createPassenger({
      fullName: value.fullName,
      email: value.email,
      passwordHash,
    });
    const passenger = await findPublicPassengerById(passengerId);

    setSessionCookie(res, passengerId);
    return res.status(201).json({ passenger });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    return next(error);
  }
}

export async function loginPassenger(req, res, next) {
  const { value, errors } = normalizeLogin(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const passenger = await findPassengerByEmail(value.email);
    const passwordMatches = passenger
      ? await bcrypt.compare(value.password, passenger.password_hash)
      : false;

    if (!passenger || !passenger.is_active || !passwordMatches) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }

    const publicPassenger = await findPublicPassengerById(passenger.passenger_id);
    setSessionCookie(res, passenger.passenger_id);
    return res.json({ passenger: publicPassenger });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentPassenger(req, res, next) {
  try {
    const passenger = await findPublicPassengerById(req.auth.passengerId);
    if (!passenger) {
      res.clearCookie(COOKIE_NAME, sessionCookieOptions('/api'));
      return res.status(401).json({ message: 'This account is no longer active.' });
    }
    return res.json({ passenger });
  } catch (error) {
    return next(error);
  }
}

export function logoutPassenger(req, res) {
  res.clearCookie(COOKIE_NAME, sessionCookieOptions('/api'));
  return res.status(204).end();
}
