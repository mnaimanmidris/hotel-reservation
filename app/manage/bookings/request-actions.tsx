"use client";

import { useActionState } from "react";
import { approveCancellation, rejectCancellation } from "./actions";
import { Button } from "@/components/ui/button";

export function RequestActions({ bookingId }: { bookingId: string }) {
  const [approveState, approveAction, approving] = useActionState(
    approveCancellation,
    null
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectCancellation,
    null
  );
  const busy = approving || rejecting;

  return (
    <div className="flex flex-col gap-2">
      <form
        action={approveAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Approve this cancellation? The customer will be refunded automatically."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="booking_id" value={bookingId} />
        <Button type="submit" size="sm" disabled={busy}>
          {approving ? "Refunding..." : "Approve and refund"}
        </Button>
      </form>

      <form
        action={rejectAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Reject this request? The booking stays confirmed and the customer is told."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="booking_id" value={bookingId} />
        <Button type="submit" variant="outline" size="sm" disabled={busy}>
          {rejecting ? "Rejecting..." : "Reject"}
        </Button>
      </form>

      {approveState?.error && (
        <p className="text-xs text-red-600">{approveState.error}</p>
      )}
      {rejectState?.error && (
        <p className="text-xs text-red-600">{rejectState.error}</p>
      )}
      {approveState?.message && (
        <p className="text-xs text-green-700">{approveState.message}</p>
      )}
      {rejectState?.message && (
        <p className="text-xs text-green-700">{rejectState.message}</p>
      )}
    </div>
  );
}