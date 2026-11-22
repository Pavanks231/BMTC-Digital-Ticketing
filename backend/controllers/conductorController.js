import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sessionCookieOptions } from '../config/sessionCookie.js';
import {
  findConductorByEmail,
  findConductorDashboard,
  setConductorTripCurrentStop,
} from '../models/Conductor.js';
import { normalizeLogin } from '../validators/authValidation.js';
import { normalizeStopUpdate } from '../validators/conductorValidation.js';

const COOKIE_NAME = 'bmtc_conductor_session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export async function loginConductor(req, res, next) {
  const { value, errors } = normalizeLogin(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const conductor = await findConductorByEmail(value.email);
    const passwordMatches = conductor
      ? await bcrypt.compare(value.password, conductor.password_hash)
      : false;

    if (!conductor || !conductor.is_active || !passwordMatches) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }

    const token = jwt.sign(
      { role: 'conductor' },
      process.env.JWT_SECRET,
      { subject: String(conductor.conductor_id), expiresIn: process.env.JWT_EXPIRES_IN || '12h' },
    );
    res.cookie(COOKIE_NAME, token, sessionCookieOptions('/api/conductor', SESSION_MAX_AGE_MS));
    return res.json({ conductor: {
      id: Number(conductor.conductor_id),
      fullName: conductor.full_name,
      email: conductor.email,
    } });
  } catch (error) {
    return next(error);
  }
}

export function logoutConductor(req, res) {
  res.clearCookie(COOKIE_NAME, sessionCookieOptions('/api/conductor'));
  return res.status(204).end();
}

export async function getConductorDashboard(req, res, next) {
  try {
    const dashboard = await findConductorDashboard(req.auth.conductorId);
    if (!dashboard) {
      res.clearCookie(COOKIE_NAME, sessionCookieOptions('/api/conductor'));
      return res.status(401).json({ message: 'This conductor account is no longer active.' });
    }
    return res.json(dashboard);
  } catch (error) {
    return next(error);
  }
}

export async function updateCurrentStop(req, res, next) {
  const { value, errors } = normalizeStopUpdate(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const update = await setConductorTripCurrentStop(req.auth.conductorId, value.sequenceNumber);
    if (update.result === 'no_active_trip') {
      return res.status(409).json({ message: 'There is no running trip assigned to this conductor.' });
    }
    if (update.result === 'stop_not_on_route') {
      return res.status(422).json({ message: 'That stop is not part of the assigned route.' });
    }

    const dashboard = await findConductorDashboard(req.auth.conductorId);
    if (!dashboard?.trip) {
      return res.status(409).json({ message: 'The active trip is no longer available.' });
    }
    return res.json({ message: 'Current stop updated.', dashboard });
  } catch (error) {
    return next(error);
  }
}
