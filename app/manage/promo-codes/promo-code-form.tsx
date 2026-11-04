"use client";

import { useActionState } from "react";
import { savePromoCode } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

export type Promo = {
  promo_code_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  is_active: boolean;
};

const selectClass = "h-9 rounded-md border bg-transparent px-2 text-sm";

export function PromoCodeForm({ promo }: { promo?: Promo }) {
  const [state, formAction, pending] = useActionState(savePromoCode, null);

  return (
    <form
      onSubmit={submitKeepingValues(formAction)}
      className="flex max-w-xl flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
    >
      {promo && <input type="hidden" name="promo_id" value={promo.promo_code_id} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          name="code"
          placeholder="NEWYEAR2027"
          defaultValue={promo?.code}
          maxLength={20}
          className="uppercase"
          required
        />
        <p className="text-xs text-muted-foreground">
          3 to 20 letters, numbers or dashes. Customers can type it in any case.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="discount_type">Discount type</Label>
          <select
            id="discount_type"
            name="discount_type"
            defaultValue={promo?.discount_type ?? "percent"}
            className={selectClass}
          >
            <option value="percent">Percent off (%)</option>
            <option value="fixed">Fixed amount off (RM)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="discount_value">Discount value</Label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={promo ? Number(promo.discount_value) : undefined}
            placeholder="10"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="valid_from">Valid from (optional)</Label>
          <Input
            id="valid_from"
            name="valid_from"
            type="date"
            defaultValue={promo?.valid_from ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="valid_until">Valid until (optional)</Label>
          <Input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={promo?.valid_until ?? ""}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        These are the dates a customer can use the code when booking. They do not
        have to match the stay dates.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="max_uses">Maximum number of uses (optional)</Label>
        <Input
          id="max_uses"
          name="max_uses"
          type="number"
          min="1"
          step="1"
          defaultValue={promo?.max_uses ?? ""}
          placeholder="Leave empty for no limit"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={promo ? promo.is_active : true}
        />
        Active (customers can use this code)
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : promo ? "Save changes" : "Add promo code"}
      </Button>
    </form>
  );
}