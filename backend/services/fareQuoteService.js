import fareConfig from '../database/data/ordinary_fare_chart.json' with { type: 'json' };
import {
  findActiveOrdinaryFareRates,
  findBusFareQuoteContext,
  findCurrentVerifiedStudentPass,
} from '../models/TransitCatalog.js';
import { calculateFare } from './fareCalculator.js';

export class FareQuoteError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FareQuoteError';
    this.status = status;
  }
}

export async function createFareQuote(
  { registrationNumber, destinationStopSequence, passengerCounts, passengerId },
  dependencies = {},
) {
  const loadBusContext = dependencies.findBusFareQuoteContext ?? findBusFareQuoteContext;
  const loadFareSchedule = dependencies.findActiveOrdinaryFareRates ?? findActiveOrdinaryFareRates;
  const findStudentPass = dependencies.findCurrentVerifiedStudentPass ?? findCurrentVerifiedStudentPass;

  const context = dependencies.findBusFareQuoteContext
    ? await loadBusContext(registrationNumber)
    : await loadBusContext(registrationNumber, dependencies.executor, Boolean(dependencies.lockActiveTrip));
  if (!context) throw new FareQuoteError('That bus is not active in the local register.', 404);
  if (!context.trip) throw new FareQuoteError('This bus has no active trip right now.', 409);
  if (context.trip.currentStopSequence === null) {
    throw new FareQuoteError('The conductor has not set a current boarding stop yet.', 409);
  }

  const boardingStop = context.stops.find((stop) => stop.sequence === context.trip.currentStopSequence);
  if (!boardingStop) throw new FareQuoteError('The active trip has no valid boarding stop.', 409);
  const destinationStop = context.stops.find((stop) => stop.sequence === destinationStopSequence);
  if (!destinationStop || destinationStop.sequence <= boardingStop.sequence) {
    throw new FareQuoteError('Choose a destination after the current boarding stop.', 422);
  }

  const fareSchedule = await loadFareSchedule(dependencies.executor);
  if (!fareSchedule?.ratesByStage.size) {
    throw new FareQuoteError('No active ordinary-service fare chart is configured.', 503);
  }

  const studentCount = passengerCounts
    .filter((item) => item.category === 'student')
    .reduce((sum, item) => sum + item.count, 0);
  const verifiedStudentPass = studentCount > 0
    ? await findStudentPass(passengerId, context.trip.routeCode, dependencies.executor)
    : null;
  const studentPassVerifiedCount = verifiedStudentPass ? Math.min(studentCount, 1) : 0;

  let fare;
  try {
    fare = calculateFare({
      stopIntervalCount: destinationStop.sequence - boardingStop.sequence,
      passengerCounts,
      ratesByStage: fareSchedule.ratesByStage,
      studentPassVerifiedCount,
      stopIntervalsPerStage: fareConfig.stopIntervalsPerStage,
      distancePerStageKm: fareConfig.distancePerStageKm,
      currency: fareSchedule.schedule.currency,
    });
  } catch (error) {
    if (error instanceof RangeError) throw new FareQuoteError(error.message, 422);
    throw error;
  }

  return {
    bus: { registrationNumber: context.bus.registration_number },
    trip: {
      code: context.trip.code,
      routeCode: context.trip.routeCode,
      routeName: context.trip.routeName,
      direction: context.trip.direction,
    },
    boardingStop,
    destinationStop,
    fare,
    fareSchedule: fareSchedule.schedule,
    estimated: true,
    ticketRecord: {
      tripId: context.trip.id,
      routeDirectionId: context.trip.routeDirectionId,
      boardingStopSequence: boardingStop.sequence,
      destinationStopSequence: destinationStop.sequence,
      fareScheduleId: fareSchedule.schedule.id,
      studentPassId: verifiedStudentPass?.id ?? null,
    },
  };
}
