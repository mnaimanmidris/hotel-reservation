const DAY = 24 * 60 * 60 * 1000;

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

type PricedBooking = {
  check_in: string;
  check_out: string;
  rooms_booked: number;
  price_at_booking: number | string;
  discount_amount?: number | string | null;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

// Price before any discount: nights x rooms x price per night
export function bookingGross(b: PricedBooking) {
  return money(
    nightsBetween(b.check_in, b.check_out) *
      b.rooms_booked *
      Number(b.price_at_booking)
  );
}

// What the customer pays: the gross price minus the saved discount
export function bookingTotal(b: PricedBooking) {
  return Math.max(0, money(bookingGross(b) - Number(b.discount_amount ?? 0)));
}