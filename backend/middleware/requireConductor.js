import jwt from 'jsonwebtoken';

export function requireConductor(req, res, next) {
  const token = req.cookies?.bmtc_conductor_session;
  if (!token) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'conductor' || !payload.sub || !/^\d+$/.test(payload.sub)) {
      return res.status(401).json({ message: 'Your session is not valid.' });
    }
    req.auth = { conductorId: Number(payload.sub) };
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}
