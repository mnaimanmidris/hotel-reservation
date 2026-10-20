// Customers can change dates and cancel with an automatic refund up to this many
// days before check-in. After that, a cancellation needs hotel approval.
// Placeholder value, adjust it here. Future improvement: let each hotel set its own.
export const FREE_CHANGE_DEADLINE_DAYS = 3;

const DAY = 24 * 60 * 60 * 1000;

export function daysUntil(date: string, today: string) {
  return Math.round(
    (new Date(date).getTime() - new Date(today).getTime()) / DAY
  );
}

export function withinFreeChangeWindow(checkIn: string, today: string) {
  return daysUntil(checkIn, today) >= FREE_CHANGE_DEADLINE_DAYS;
}

// A request is still possible until the day before check-in
export function canRequestCancellation(checkIn: string, today: string) {
  return daysUntil(checkIn, today) >= 1;
}