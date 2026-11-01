import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { coverImagePath, roomImageUrl } from "@/lib/room-image-url";
import { DeleteRoomButton } from "./delete-room-button";

export const metadata = { title: "Room listings" };

type RoomRow = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  availability_status: string;
  max_guests: number;
  quantity: number;
  room_images: { image_path: string; sort_order: number }[] | null;
};

const GREEN = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
const RED = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

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

  const { data, error } = await supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, availability_status, max_guests, quantity, room_images(image_path, sort_order)"
    )
    .eq("hotel_id", hotel.hotel_id)
    .order("room_name");

  if (error) {
    return <p>Could not load rooms: {error.message}</p>;
  }

  const rooms = (data ?? []) as unknown as RoomRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{hotel.hotel_name}</h2>
        <Link href="/manage/rooms/new" className={buttonVariants()}>
          Add room
        </Link>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rooms yet. Add your first room.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rooms.map((room) => {
            const cover = coverImagePath(room.room_images);
            const available = room.availability_status === "available";
            return (
              <article
                key={room.room_id}
                className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 sm:flex-row sm:items-center"
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={roomImageUrl(cover)}
                    alt={`${room.room_name} photo`}
                    className="hidden aspect-[4/3] w-36 shrink-0 rounded-lg object-cover sm:block"
                  />
                ) : (
                  <div className="hidden aspect-[4/3] w-36 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground sm:flex">
                    No photo
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{room.room_name}</h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        available ? GREEN : RED
                      }`}
                    >
                      {available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {room.room_type} · RM {Number(room.price_per_night).toFixed(2)} / night
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Up to {room.max_guests} guest{room.max_guests === 1 ? "" : "s"} per room
                    · {room.quantity} room{room.quantity === 1 ? "" : "s"} of this type
                  </p>
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  <Link
                    href={`/manage/rooms/${room.room_id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Edit
                  </Link>
                  <DeleteRoomButton roomId={room.room_id} roomName={room.room_name} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ManageRoomsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Room listings</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <ManageRooms />
      </Suspense>
    </main>
  );
}