"use client";

import { useActionState } from "react";
import { updateBookingDatesByHotel } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditForm({
  bookingId,
  checkIn,
  checkOut,
  nights,
}: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
}) {
  const [state, formAction, pending] = useActionState(
    updateBookingDatesByHotel,
    null
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm">
        Choose new dates for the same number of nights ({nights}). The price
        stays the same, and the guest is notified by email.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="check_in">New check-in</Label>
        <Input id="check_in" name="check_in" type="date" defaultValue={checkIn} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="check_out">New check-out</Label>
        <Input id="check_out" name="check_out" type="date" defaultValue={checkOut} required />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save new dates"}
      </Button>
    </form>
  );
}