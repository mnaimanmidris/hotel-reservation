"use client";

import { useActionState } from "react";
import { requestCancellation } from "./actions";
import { Button } from "@/components/ui/button";

export function CancelBookingButton({
  bookingId,
  immediate,
}: {
  bookingId: string;
  immediate: boolean;
}) {
  const [state, formAction, pending] = useActionState(requestCancellation, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const text = immediate
          ? "Cancel this booking? You will be refunded automatically."
          : "Request to cancel this booking? The hotel must approve it before any refund.";
        if (!window.confirm(text)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending
          ? "Working..."
          : immediate
            ? "Cancel and refund"
            : "Request cancellation"}
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      )}
      {state?.message && (
        <p className="mt-1 text-xs text-green-700">{state.message}</p>
      )}
    </form>
  );
}