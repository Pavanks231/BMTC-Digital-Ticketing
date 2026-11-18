import { Router } from 'express';
import {
  createTicket,
  getTicketDetails,
  getTicketHistory,
} from '../controllers/ticketController.js';
import { requirePassenger } from '../middleware/requirePassenger.js';

const router = Router();

router.use(requirePassenger);
router.get('/', getTicketHistory);
router.post('/', createTicket);
router.get('/:publicId', getTicketDetails);

export default router;
