import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getCurrentPassenger,
  loginPassenger,
  logoutPassenger,
  registerPassenger,
} from '../controllers/authController.js';
import { requirePassenger } from '../middleware/requirePassenger.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

router.post('/register', authLimiter, registerPassenger);
router.post('/login', authLimiter, loginPassenger);
router.post('/logout', logoutPassenger);
router.get('/me', requirePassenger, getCurrentPassenger);

export default router;
