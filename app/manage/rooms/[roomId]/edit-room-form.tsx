"use client";

import { useActionState } from "react";
import { updateRoom } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

type Room = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  availability_status: string;
  max_guests: number;
};

const selectClass = "h-9 rounded-md border bg-transparent px-2 text-sm";

export function EditRoomForm({room, children,}: {room: Room; children?: React.ReactNode;}) {
  const [state, formAction, pending] = useActionState(updateRoom, null);

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="room_id" value={room.room_id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="room_name">Room name</Label>
        <Input id="room_name" name="room_name" defaultValue={room.room_name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="room_type">Room type</Label>
        <select id="room_type" name="room_type" defaultValue={room.room_type} className={selectClass}>
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
          defaultValue={room.price_per_night}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="max_guests">Maximum guests</Label>
        <Input
          id="max_guests"
          name="max_guests"
          type="number"
          min="1"
          max="20"
          step="1"
          defaultValue={room.max_guests}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="availability_status">Status</Label>
        <select
          id="availability_status"
          name="availability_status"
          defaultValue={room.availability_status}
          className={selectClass}
        >
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {children}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}