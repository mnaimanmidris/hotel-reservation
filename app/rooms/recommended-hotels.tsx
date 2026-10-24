import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations, getStartingHotel } from "@/lib/recommendations";

type RecommendedRoom = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  hotels: { hotel_name: string } | null;
};

export async function RecommendedHotels() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null; // guests see no recommendations

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.role !== "customer") return null; // hotel management too

  const startingHotel = await getStartingHotel(userId);
  const recommendations = await getRecommendations(startingHotel);
  if (recommendations.length === 0) return null;

  // Map the recommended hotels to their available rooms
  const { data: roomData } = await supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, hotels!inner(hotel_name)"
    )
    .eq("availability_status", "available")
    .in(
      "hotels.hotel_name",
      recommendations.map((r) => r.hotelName)
    )
    .order("price_per_night");
  const rooms = (roomData ?? []) as unknown as RecommendedRoom[];

  const similar = recommendations[0].source === "similar";

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl">
        {similar ? `Similar to ${startingHotel}` : "Popular hotels"}
      </h2>
      <ol className="list-decimal pl-5 text-sm">
        {recommendations.map((r) => {
          const hotelRooms = rooms.filter(
            (room) => room.hotels?.hotel_name === r.hotelName
          );
          return (
            <li key={r.hotelName} className="mb-2">
              <span className="font-medium">{r.hotelName}</span>
              {hotelRooms.length === 0 ? (
                <p>No available rooms listed on this site yet.</p>
              ) : (
                <ul className="mt-1">
                  {hotelRooms.map((room) => (
                    <li key={room.room_id}>
                      {room.room_name} ({room.room_type}), RM{" "}
                      {Number(room.price_per_night).toFixed(2)} per night{" "}
                      <Link
                        href={`/book/${room.room_id}`}
                        className="underline"
                      >
                        Book this room
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}