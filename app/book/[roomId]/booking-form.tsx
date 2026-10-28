"use client";

import { useActionState, useState } from "react";
import { startBooking } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roomImageUrl } from "@/lib/room-image-url";
import { submitKeepingValues } from "@/lib/submit-keep-values";

type Defaults = { name: string; email: string; phone: string };
type RoomInfo = {
  name: string;
  hotelName: string;
  type: string;
  quantity: number;
  pricePerNight: number;
  maxGuests: number;
  coverPath: string | null;
};
type Initial = { checkIn: string; checkOut: string; guests: number };

const DAY = 24 * 60 * 60 * 1000;
const panel = "flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10";

function utc(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function formatDate(date: string) {
  return utc(date).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export function BookingForm({
  roomId,
  today,
  room,
  initial,
  defaults,
}: {
  roomId: string;
  today: string;
  room: RoomInfo;
  initial: Initial;
  defaults: Defaults;
}) {
  const [state, formAction, pending] = useActionState(startBooking, null);
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState(String(initial.guests));

  const nights =
    checkIn && checkOut && checkOut > checkIn
      ? Math.round((utc(checkOut).getTime() - utc(checkIn).getTime()) / DAY)
      : null;
  const guestCount = Number(guests);
  const roomsNeeded =
    Number.isInteger(guestCount) && guestCount >= 1
      ? Math.ceil(guestCount / room.maxGuests)
      : 1;
  const total = nights ? nights * roomsNeeded * room.pricePerNight : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <form
        onSubmit={submitKeepingValues(formAction)}
        className="order-2 flex flex-col gap-6 lg:order-1"
      >
        <input type="hidden" name="room_id" value={roomId} />

        <section className={panel}>
          <h2 className="text-lg font-medium">Booking details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="check_in">Check-in</Label>
              <Input
                id="check_in"
                name="check_in"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="check_out">Check-out</Label>
              <Input
                id="check_out"
                name="check_out"
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guests">Number of guests</Label>
            <Input
              id="guests"
              name="guests"
              type="number"
              min="1"
              max={room.maxGuests * room.quantity}
              step="1"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {room.quantity > 1
                ? `Each room fits up to ${room.maxGuests} guest${room.maxGuests === 1 ? "" : "s"}. We book as many rooms as your party needs (up to ${room.quantity}).`
                : `This room allows up to ${room.maxGuests} guest${room.maxGuests === 1 ? "" : "s"}.`}
            </p>
          </div>
        </section>

        <section className={panel}>
          <h2 className="text-lg font-medium">Contact details</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest_name">Full name</Label>
            <Input id="guest_name" name="guest_name" defaultValue={defaults.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest_email">Email</Label>
            <Input
              id="guest_email"
              name="guest_email"
              type="email"
              defaultValue={defaults.email}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest_phone">Phone number</Label>
            <Input
              id="guest_phone"
              name="guest_phone"
              type="tel"
              placeholder="+60123456789"
              pattern="\+[0-9]{8,15}"
              title="Start with the country code, for example +60123456789"
              defaultValue={defaults.phone}
              required
            />
          </div>
        </section>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? "Redirecting to payment..." : "Proceed to payment"}
        </Button>
      </form>

      <aside className="order-1 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:order-2 lg:sticky lg:top-6">
        {room.coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={roomImageUrl(room.coverPath)}
            alt={`${room.name} at ${room.hotelName}`}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
            No photo yet
          </div>
        )}
        <div className="flex flex-col gap-3 p-5">
          <h2 className="text-lg font-medium">Booking summary</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <SummaryRow label="Room" value={room.name} />
            <SummaryRow label="Hotel" value={room.hotelName} />
            <SummaryRow label="Type" value={room.type} />
            <SummaryRow label="Check-in" value={checkIn ? formatDate(checkIn) : "-"} />
            <SummaryRow label="Check-out" value={checkOut ? formatDate(checkOut) : "-"} />
            <SummaryRow label="Nights" value={nights ? String(nights) : "-"} />
            <SummaryRow label="Guests" value={guests || "-"} />
            <SummaryRow label="Rooms" value={String(roomsNeeded)} />
          </dl>
          <div className="flex flex-col gap-2 border-t pt-3 text-sm">
            <SummaryRow label="Price / room / night" value={`RM ${room.pricePerNight.toFixed(2)}`} />
            <div className="flex justify-between gap-4 font-medium">
              <span>Total</span>
              <span className="text-primary">
                {total ? `RM ${total.toFixed(2)}` : "Select dates"}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}