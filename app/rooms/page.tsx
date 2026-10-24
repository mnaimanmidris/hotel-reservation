import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import Link from "next/link";
import { RecommendedHotels } from "./recommended-hotels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Room = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  availability_status: string;
  hotels: { hotel_name: string } | null;
};

async function RoomList() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, availability_status, hotels(hotel_name)"
    )
    .order("price_per_night");

  if (error) {
    return <p>Could not load rooms: {error.message}</p>;
  }

  const rooms = data as unknown as Room[] | null;

  if (!rooms || rooms.length === 0) {
    return <p>No rooms available yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <Card key={room.room_id}>
          <CardHeader>
            <CardTitle>{room.room_name}</CardTitle>
            <CardDescription>
              {room.hotels?.hotel_name} · {room.room_type}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              RM {Number(room.price_per_night).toFixed(2)}{" "}
              <span className="text-sm font-normal">per night</span>
            </p>
            <p className="text-sm">
              {room.availability_status === "available"
                ? "Available"
                : "Unavailable"}
            </p>
            {room.availability_status === "available" && (
              <Link href={`/book/${room.room_id}`} className="mt-2 inline-block underline">
                Book this room
              </Link>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function RoomsPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Rooms</h1>
      <Suspense fallback={null}>
        <RecommendedHotels />
      </Suspense>
      <Suspense fallback={<p>Loading rooms...</p>}>
        <RoomList />
      </Suspense>
    </main>
  );
}