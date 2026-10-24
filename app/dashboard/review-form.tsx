"use client";

import { useActionState, useState } from "react";
import { submitReview } from "./review-actions";
import { Button } from "@/components/ui/button";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitReview, null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Write review
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-56 flex-col gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <label className="text-xs">
        Rating
        <select
          name="rating"
          defaultValue="5"
          className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Average</option>
          <option value="2">2 - Poor</option>
          <option value="1">1 - Terrible</option>
        </select>
      </label>
      <label className="text-xs">
        Comment (optional)
        <textarea
          name="review_text"
          rows={3}
          maxLength={1000}
          className="mt-1 w-full rounded-lg border border-input bg-transparent px-2 py-1 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Submitting..." : "Submit"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Close
        </Button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.message && (
        <p className="text-xs text-green-700">{state.message}</p>
      )}
    </form>
  );
}