"use client";

import { useActionState } from "react";
import { deletePromoCode, togglePromoCode } from "./actions";
import { Button } from "@/components/ui/button";

export function TogglePromoButton({
  promoId,
  active,
}: {
  promoId: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(togglePromoCode, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="promo_id" value={promoId} />
      <input type="hidden" name="make_active" value={active ? "false" : "true"} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {active ? "Turn off" : "Turn on"}
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}

export function DeletePromoButton({
  promoId,
  code,
}: {
  promoId: string;
  code: string;
}) {
  const [state, formAction, pending] = useActionState(deletePromoCode, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Delete promo code "${code}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="promo_id" value={promoId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Deleting..." : "Delete"}
      </Button>
      {state?.error && (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}