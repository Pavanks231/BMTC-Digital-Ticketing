import { Router } from 'express';
import { getCurrentStudentPass } from '../controllers/studentPassController.js';
import { requirePassenger } from '../middleware/requirePassenger.js';

const router = Router();

router.get('/current', requirePassenger, getCurrentStudentPass);

export default router;
