import jwt from 'jsonwebtoken';

export function requirePassenger(req, res, next) {
  const token = req.cookies?.bmtc_session;

  if (!token) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'passenger' || !payload.sub) {
      return res.status(401).json({ message: 'Your session is not valid.' });
    }

    req.auth = { passengerId: Number(payload.sub) };
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}
