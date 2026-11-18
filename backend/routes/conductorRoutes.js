import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getConductorDashboard,
  loginConductor,
  logoutConductor,
  updateCurrentStop,
} from '../controllers/conductorController.js';
import { requireConductor } from '../middleware/requireConductor.js';
import { createAssistedStudentTicket } from '../controllers/ticketController.js';
import {
  getConductorTicketVerificationHistory,
  verifyConductorTicket,
} from '../controllers/ticketVerificationController.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

router.post('/auth/login', authLimiter, loginConductor);
router.post('/auth/logout', logoutConductor);
router.get('/dashboard', requireConductor, getConductorDashboard);
router.patch('/trips/current-stop', requireConductor, updateCurrentStop);
router.post('/tickets/verify', requireConductor, verifyConductorTicket);
router.get('/tickets/verification-history', requireConductor, getConductorTicketVerificationHistory);
router.post('/tickets/assisted', requireConductor, createAssistedStudentTicket);

export default router;
