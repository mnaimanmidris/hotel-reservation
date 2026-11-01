"use client";

import { useActionState } from "react";
import { updateHotel } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

type Hotel = {
  hotel_name: string;
  description: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export function HotelForm({ hotel }: { hotel: Hotel }) {
  const [state, formAction, pending] = useActionState(updateHotel, null);

  return (
    <form
      onSubmit={submitKeepingValues(formAction)}
      className="flex max-w-xl flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="hotel_name">Hotel name</Label>
        <Input id="hotel_name" value={hotel.hotel_name} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          The name can't be changed here. Contact the system administrator.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={1000}
          defaultValue={hotel.description ?? ""}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          maxLength={300}
          defaultValue={hotel.address ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact_email">Contact email</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={hotel.contact_email ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact_phone">Contact phone</Label>
        <Input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          placeholder="+60312345678"
          pattern="\+[0-9]{8,15}"
          title="Start with the country code, for example +60312345678"
          defaultValue={hotel.contact_phone ?? ""}
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && (
        <p className="text-sm text-green-700 dark:text-green-400">{state.message}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}