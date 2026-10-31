import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { coverImagePath } from "@/lib/room-image-url";
import { todayInMalaysia } from "@/lib/room-listing";
import { BookingForm } from "./booking-form";

type Room = {
  room_id: string;
  room_name: string;
  room_type: string;
  quantity: number;
  price_per_night: number;
  max_guests: number;
  availability_status: string;
  hotels: { hotel_name: string } | null;
  room_images: { image_path: string; sort_order: number }[] | null;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function BookRoom({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: SearchParams;
}) {
  await connection();
  const { roomId } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;

  const { data } = await supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, max_guests, quantity, availability_status, hotels(hotel_name), room_images(image_path, sort_order)"
    )
    .eq("room_id", roomId)
    .maybeSingle();

  const room = data as unknown as Room | null;
  if (!room || room.availability_status !== "available") {
    return <p>This room is not available.</p>;
  }

  const { data: profile } = userId
    ? await supabase
        .from("users")
        .select("full_name, email, phone")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  // Dates and guests carried over from the room search
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const checkIn = pick(query, "check_in");
  const checkOut = pick(query, "check_out");
  const guestsParam = Number(pick(query, "guests"));
  const guests =
    Number.isInteger(guestsParam) && guestsParam >= 1 && guestsParam <= room.max_guests * room.quantity
      ? guestsParam
      : 1;

  return (
    <BookingForm
      roomId={room.room_id}
      today={todayInMalaysia()}
      room={{
        name: room.room_name,
        hotelName: room.hotels?.hotel_name ?? "",
        type: room.room_type,
        pricePerNight: Number(room.price_per_night),
        maxGuests: room.max_guests,
        quantity: room.quantity,
        coverPath: coverImagePath(room.room_images),
      }}
      initial={{
        checkIn: isDate(checkIn) ? checkIn : "",
        checkOut: isDate(checkOut) ? checkOut : "",
        guests,
      }}
      defaults={{
        name: profile?.full_name ?? "",
        email: profile?.email ?? "",
        phone: profile?.phone ?? "",
      }}
    />
  );
}

export default function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <Link href="/rooms" className="text-sm underline">
        Back to rooms
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Book a room</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <BookRoom params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}