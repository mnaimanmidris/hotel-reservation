import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EditRoomForm } from "./edit-room-form";
import { RoomPhotos } from "../room-photos";

async function EditRoom({ params }: { params: Promise<{ roomId: string }> }) {
  await connection();
  const { roomId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select(
      "room_id, hotel_id, room_name, room_type, price_per_night, availability_status, max_guests"
    )
    .eq("room_id", roomId)
    .maybeSingle();

  const { data: hotel } = room
    ? await supabase
        .from("hotels")
        .select("hotel_id")
        .eq("hotel_id", room.hotel_id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  if (!room || !hotel) {
    return <p>Room not found, or you do not manage this hotel.</p>;
  }

  const { data: images } = await supabase
    .from("room_images")
    .select("image_id, image_path, sort_order")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: true });

  return (
    <EditRoomForm room={room}>
      <RoomPhotos roomId={room.room_id} images={images ?? []} />
    </EditRoomForm>
  );
}

export default function EditRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/manage/rooms" className="text-sm underline">
        Back to rooms
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Edit room</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <EditRoom params={params} />
      </Suspense>
    </main>
  );
}