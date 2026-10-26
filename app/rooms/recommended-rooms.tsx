import { connection } from "next/server";
import { RoomCard } from "@/components/room-card";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations, getStartingHotel } from "@/lib/recommendations";
import { bookingLink, getRoomCards, type RoomFilters } from "@/lib/room-listing";

const MAX_RECOMMENDED_ROOMS = 6;

export async function RecommendedRooms({ filters }: { filters: RoomFilters }) {
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

  const { rooms } = await getRoomCards(
    filters,
    recommendations.map((r) => r.hotelName)
  );

  // Keep the algorithm's hotel order, cheaper rooms first within a hotel
  const rank = new Map(recommendations.map((r, index) => [r.hotelName, index]));
  const ordered = [...rooms]
    .sort(
      (a, b) =>
        (rank.get(a.hotel_name) ?? 0) - (rank.get(b.hotel_name) ?? 0) ||
        a.price_per_night - b.price_per_night
    )
    .slice(0, MAX_RECOMMENDED_ROOMS);

  const similar = recommendations[0].source === "similar";

  return (
    <section className="mb-10">
      <h2 className="text-xl">Recommended for you</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {similar ? `Similar to ${startingHotel}` : "Popular hotels"}
      </p>
      {ordered.length === 0 ? (
        <p className="text-sm">
          No rooms are available at the recommended hotels right now.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((room) => (
            <RoomCard
              key={room.room_id}
              room={room}
              bookHref={bookingLink(room.room_id, filters)}
              recommended
            />
          ))}
        </div>
      )}
    </section>
  );
}