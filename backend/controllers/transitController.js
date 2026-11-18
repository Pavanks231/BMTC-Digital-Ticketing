import {
  findRouteDirection,
  findBusBoardingInfo,
  listActiveBuses,
  listActiveRoutes,
} from '../models/TransitCatalog.js';
import { createFareQuote, FareQuoteError } from '../services/fareQuoteService.js';
import { normalizeFareQuote } from '../validators/fareQuoteValidation.js';
import {
  normalizeDirection,
  normalizeBusRegistration,
  normalizeRouteCode,
  normalizeRouteSearch,
} from '../validators/transitValidation.js';

export async function getRoutes(req, res, next) {
  const { value, errors } = normalizeRouteSearch(req.query.q);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const routes = await listActiveRoutes(value.search);
    return res.json({ routes, total: routes.length });
  } catch (error) {
    return next(error);
  }
}

export async function getRouteDirection(req, res, next) {
  const code = normalizeRouteCode(req.params.routeCode);
  const direction = normalizeDirection(req.params.direction);
  const errors = [...code.errors, ...direction.errors];
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const route = await findRouteDirection(code.value.routeCode, direction.value.direction);
    if (!route) return res.status(404).json({ message: 'That route direction was not found.' });
    return res.json({ route });
  } catch (error) {
    return next(error);
  }
}

export async function getBuses(req, res, next) {
  try {
    const buses = await listActiveBuses();
    return res.json({ buses, total: buses.length });
  } catch (error) {
    return next(error);
  }
}

export async function getBusBoardingInfo(req, res, next) {
  const { value, errors } = normalizeBusRegistration(req.params.registrationNumber);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const boardingInfo = await findBusBoardingInfo(value.registrationNumber);
    if (!boardingInfo) return res.status(404).json({ message: 'That bus is not active in the local register.' });
    if (!boardingInfo.trip) {
      return res.status(409).json({
        message: 'This bus has no active trip right now.',
        bus: boardingInfo.bus,
      });
    }
    return res.json(boardingInfo);
  } catch (error) {
    return next(error);
  }
}

export async function postBusFareQuote(req, res, next) {
  const registration = normalizeBusRegistration(req.params.registrationNumber);
  const { value, errors } = normalizeFareQuote(req.body);
  errors.unshift(...registration.errors);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const quote = await createFareQuote({
      registrationNumber: registration.value.registrationNumber,
      destinationStopSequence: value.destinationStopSequence,
      passengerCounts: value.passengerCounts,
      passengerId: req.auth.passengerId,
    });
    const { ticketRecord, fareSchedule, ...quoteFields } = quote;
    const { id: fareScheduleId, ...publicFareSchedule } = fareSchedule;
    const publicQuote = { ...quoteFields, fareSchedule: publicFareSchedule };
    return res.json({ quote: publicQuote });
  } catch (error) {
    if (error instanceof FareQuoteError) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}
