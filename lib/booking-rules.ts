// Minutes an unpaid booking keeps the dates blocked. Not a setting on purpose:
// the Stripe payment page expires after 31 minutes, so the hold must stay longer.
export const HOLD_MINUTES = 35;

// The free change deadline (days before check-in) is a setting that hotel
// management edits: see rules.free_change_deadline_days in lib/settings.ts

const DAY = 24 * 60 * 60 * 1000;

export function daysUntil(date: string, today: string) {
  return Math.round(
    (new Date(date).getTime() - new Date(today).getTime()) / DAY
  );
}

export function withinFreeChangeWindow(
  checkIn: string,
  today: string,
  deadlineDays: number
) {
  return daysUntil(checkIn, today) >= deadlineDays;
}

// A request is still possible until the day before check-in
export function canRequestCancellation(checkIn: string, today: string) {
  return daysUntil(checkIn, today) >= 1;
}