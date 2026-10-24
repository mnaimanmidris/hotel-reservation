"use client";

import { useActionState } from "react";
import { startBooking } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


type Defaults = { name: string; email: string; phone: string };

export function BookingForm({
  roomId,
  defaults,
}: {
  roomId: string;
  defaults: Defaults;
}) {
  const [state, formAction, pending] = useActionState(startBooking, null);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="room_id" value={roomId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="check_in">Check-in</Label>
        <Input id="check_in" name="check_in" type="date" defaultValue={state?.values?.check_in ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="check_out">Check-out</Label>
        <Input id="check_out" name="check_out" type="date" defaultValue={state?.values?.check_out ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="guest_name">Guest name</Label>
        <Input id="guest_name" name="guest_name" defaultValue={state?.values?.guest_name ?? defaults.name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="guest_email">Email</Label>
        <Input id="guest_email" name="guest_email" type="email" defaultValue={state?.values?.guest_email ?? defaults.email} required/>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="guest_phone">Phone number</Label>
        <Input id="guest_phone" name="guest_phone" type="tel" placeholder="+60123456789" pattern="\+[0-9]{8,15}" title="Start with the country code, for example +60123456789" defaultValue={state?.values?.guest_phone ?? defaults.phone} required/>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Redirecting to payment..." : "Continue to payment"}
      </Button>
    </form>
  );
}