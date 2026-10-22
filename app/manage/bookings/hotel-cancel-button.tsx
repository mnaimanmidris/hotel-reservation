"use client";

import { useActionState } from "react";
import { cancelBookingByHotel } from "./actions";
import { Button } from "@/components/ui/button";

export function HotelCancelButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(cancelBookingByHotel, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Cancel this booking? The guest will be refunded automatically and notified by email."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Cancelling..." : "Cancel and refund"}
      </Button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.message && (
        <p className="mt-1 text-xs text-green-700">{state.message}</p>
      )}
    </form>
  );
}