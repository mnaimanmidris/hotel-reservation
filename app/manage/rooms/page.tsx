import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AddRoomForm } from "./add-room-form";
import { DeleteRoomButton } from "./delete-room-button";

async function ManageRooms() {
  await connection();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.role !== "hotel_management") {
    notFound();
  }

  const { data: hotel } = await supabase
    .from("hotels")
    .select("hotel_id, hotel_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!hotel) {
    return (
      <p>
        No hotel is linked to your account yet. Please contact the system
        administrator.
      </p>
    );
  }

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("room_id, room_name, room_type, price_per_night, availability_status")
    .eq("hotel_id", hotel.hotel_id)
    .order("room_name");

  if (error) {
    return <p>Could not load rooms: {error.message}</p>;
  }

  return (
    <div>
      <h2 className="mb-4 text-xl">{hotel.hotel_name}</h2>
      <AddRoomForm />
      {rooms && rooms.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-6">Room</th>
              <th className="py-2 pr-6">Type</th>
              <th className="py-2 pr-6">Price per night (RM)</th>
              <th className="py-2 pr-6">Status</th>
              <th className="py-2 pr-6"></th>
              <th className="py-2 pr-6"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.room_id} className="border-b">
                <td className="py-2 pr-6">{room.room_name}</td>
                <td className="py-2 pr-6">{room.room_type}</td>
                <td className="py-2 pr-6">
                  {Number(room.price_per_night).toFixed(2)}
                </td>
                <td className="py-2 pr-6 capitalize">{room.availability_status}</td>
                <td className="py-2 pr-6">
                  <Link href={`/manage/rooms/${room.room_id}`} className="underline">
                    Edit
                  </Link>
                </td>
                <td className="py-2 pr-6">
                  <DeleteRoomButton roomId={room.room_id} roomName={room.room_name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No rooms yet.</p>
      )}
    </div>
  );
}

export default function ManageRoomsPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/manage" className="text-sm underline">
        Back to dashboard
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Manage Room Listings</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <ManageRooms />
      </Suspense>
    </main>
  );
}