"use client";

import { useActionState, useEffect, useRef } from "react";
import { addRoom } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

const selectClass = "h-9 rounded-md border bg-transparent px-2 text-sm";

export function AddRoomForm() {
  const [state, formAction, pending] = useActionState(addRoom, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={submitKeepingValues(formAction)} className="mb-8 flex flex-col gap-4 max-w-md">
      <h3 className="text-lg font-medium">Add a room</h3>

      <div className="flex flex-col gap-2">
        <Label htmlFor="room_name">Room name</Label>
        <Input id="room_name" name="room_name" placeholder="Deluxe Twin Room" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="room_type">Room type</Label>
        <select id="room_type" name="room_type" defaultValue="Standard" className={selectClass}>
          <option value="Standard">Standard</option>
          <option value="Deluxe">Deluxe</option>
          <option value="Suite">Suite</option>
          <option value="Family">Family</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="price_per_night">Price per night (RM)</Label>
        <Input
          id="price_per_night"
          name="price_per_night"
          type="number"
          min="1"
          step="0.01"
          placeholder="450.00"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="availability_status">Status</Label>
        <select
          id="availability_status"
          name="availability_status"
          defaultValue="available"
          className={selectClass}
        >
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Room added.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add room"}
      </Button>
    </form>
  );
}