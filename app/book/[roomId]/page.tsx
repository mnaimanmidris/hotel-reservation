import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";

type Room = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  availability_status: string;
  hotels: { hotel_name: string } | null;
};

async function BookRoom({ params }: { params: Promise<{ roomId: string }> }) {
  await connection();
  const { roomId } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, availability_status, hotels(hotel_name)"
    )
    .eq("room_id", roomId)
    .maybeSingle();

  const room = data as unknown as Room | null;
  if (!room || room.availability_status !== "available") {
    return <p>This room is not available.</p>;
  }

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  const { data: profile } = userId
    ? await supabase
        .from("users")
        .select("full_name, email, phone")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl">{room.room_name}</h2>
        <p className="text-sm">
          {room.hotels?.hotel_name} · {room.room_type} · RM{" "}
          {Number(room.price_per_night).toFixed(2)} per night
        </p>
      </div>
      <BookingForm
        roomId={room.room_id}
        defaults={{
          name: profile?.full_name ?? "",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
        }}
      />
    </div>
  );
}

export default function BookPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/rooms" className="text-sm underline">
        Back to rooms
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Book a room</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <BookRoom params={params} />
      </Suspense>
    </main>
  );
}