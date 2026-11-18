import { Router } from 'express';
import {
  getBuses,
  getBusBoardingInfo,
  getRouteDirection,
  getRoutes,
  postBusFareQuote,
} from '../controllers/transitController.js';
import { requirePassenger } from '../middleware/requirePassenger.js';

const router = Router();

router.get('/buses', getBuses);
router.get('/buses/:registrationNumber/boarding', getBusBoardingInfo);
router.post('/buses/:registrationNumber/fare-quote', requirePassenger, postBusFareQuote);
router.get('/routes', getRoutes);
router.get('/routes/:routeCode/directions/:direction', getRouteDirection);

export default router;
