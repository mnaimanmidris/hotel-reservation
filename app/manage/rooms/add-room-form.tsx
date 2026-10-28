"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addRoom } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_IMAGES, uploadRoomImages } from "@/lib/room-images";

const selectClass = "h-9 rounded-md border bg-transparent px-2 text-sm";
const fileClass =
  "block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1";

export function AddRoomForm() {
  const router = useRouter();
  const photosRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const files = Array.from(photosRef.current?.files ?? []);

    if (files.length > MAX_IMAGES) {
      setError(`A room can have at most ${MAX_IMAGES} photos.`);
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    const result = await addRoom(null, formData);
    if (!result?.roomId) {
      setError(result?.error ?? "Could not add the room.");
      setPending(false);
      return;
    }

    let note = "Room added.";
    if (files.length > 0) {
      const uploadError = await uploadRoomImages(result.roomId, files);
      if (uploadError) {
        note = `Room added, but the photos failed: ${uploadError} You can add them again from Edit.`;
      }
    }

    form.reset();
    setMessage(note);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 flex max-w-md flex-col gap-4">
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
        <Label htmlFor="max_guests">Maximum guests</Label>
        <Input
          id="max_guests"
          name="max_guests"
          type="number"
          min="1"
          max="20"
          step="1"
          defaultValue={2}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="quantity">Number of rooms of this type</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min="1"
          max="500"
          step="1"
          defaultValue={1}
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="photos">Photos (optional, up to {MAX_IMAGES})</Label>
        <input
          ref={photosRef}
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className={fileClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add room"}
      </Button>
    </form>
  );
}