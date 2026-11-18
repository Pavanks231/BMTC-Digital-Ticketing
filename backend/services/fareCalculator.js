const FARE_FIELD_BY_CATEGORY = Object.freeze({
  general: 'adult',
  adult: 'adult',
  child: 'child',
  senior_citizen: 'senior',
  senior: 'senior',
});

export function chargeableStagesForStopIntervals(stopIntervalCount, stopIntervalsPerStage = 3) {
  if (!Number.isInteger(stopIntervalCount) || stopIntervalCount < 1) {
    throw new RangeError('Destination must be after the boarding stop on this route.');
  }
  if (!Number.isInteger(stopIntervalsPerStage) || stopIntervalsPerStage < 1) {
    throw new RangeError('The configured stop-to-stage mapping is invalid.');
  }

  const stages = Math.max(1, Math.ceil(stopIntervalCount / stopIntervalsPerStage));
  if (stages > 30) {
    throw new RangeError('The supplied fare chart covers trips up to 30 chargeable stages.');
  }
  return stages;
}

/**
 * Calculate from server-loaded rates and a stop interval count derived by the
 * backend. Never pass fare, stop count, or pass-verification values from a
 * passenger request directly into this function.
 */
export function calculateFare({
  stopIntervalCount,
  passengerCounts,
  ratesByStage,
  studentPassVerifiedCount = 0,
  stopIntervalsPerStage = 3,
  distancePerStageKm = 2,
  currency = 'INR',
}) {
  if (!Array.isArray(passengerCounts) || passengerCounts.length === 0) {
    throw new TypeError('At least one passenger category and count are required.');
  }

  const stages = chargeableStagesForStopIntervals(stopIntervalCount, stopIntervalsPerStage);
  const rates = ratesByStage instanceof Map ? ratesByStage.get(stages) : ratesByStage?.[stages];
  if (!rates) throw new Error(`No fare is configured for ${stages} chargeable stages.`);

  const studentCount = passengerCounts
    .filter((item) => item.category === 'student')
    .reduce((sum, item) => sum + (Number.isInteger(item.count) ? item.count : 0), 0);
  if (!Number.isInteger(studentPassVerifiedCount) || studentPassVerifiedCount < 0 || studentPassVerifiedCount > studentCount) {
    throw new RangeError('Verified student pass count must be within the student passenger count.');
  }
  let remainingVerifiedPasses = studentPassVerifiedCount;

  const lineItems = passengerCounts.map(({ category, count }) => {
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new RangeError('Each passenger count must be an integer from 1 to 50.');
    }

    if (category === 'student') {
      const adultFarePaise = Math.round(Number(rates.adult) * 100);
      if (!Number.isFinite(adultFarePaise) || adultFarePaise < 0) {
        throw new Error(`The adult fare is missing or invalid for ${stages} stages.`);
      }
      const verifiedPassCount = Math.min(count, remainingVerifiedPasses);
      remainingVerifiedPasses -= verifiedPassCount;
      const billableCount = count - verifiedPassCount;
      return {
        category,
        count,
        verifiedPassCount,
        billableCount,
        farePerBillablePassenger: adultFarePaise / 100,
        subtotal: (adultFarePaise * billableCount) / 100,
      };
    }

    const fareField = FARE_FIELD_BY_CATEGORY[category];
    if (!fareField) throw new Error(`No fare category is defined for "${category}" in this chart.`);

    const farePaise = Math.round(Number(rates[fareField]) * 100);
    if (!Number.isFinite(farePaise) || farePaise < 0) {
      throw new Error(`The ${fareField} fare is missing or invalid for ${stages} stages.`);
    }
    return {
      category,
      count,
      farePerPassenger: farePaise / 100,
      subtotal: (farePaise * count) / 100,
    };
  });

  if (lineItems.reduce((sum, item) => sum + item.count, 0) > 50) {
    throw new RangeError('A ticket cannot contain more than 50 passengers.');
  }

  const totalPaise = lineItems.reduce((sum, item) => sum + Math.round(item.subtotal * 100), 0);
  return {
    stopIntervalCount,
    estimatedDistanceKm: stages * distancePerStageKm,
    chargeableStages: stages,
    currency,
    lineItems,
    total: totalPaise / 100,
  };
}
