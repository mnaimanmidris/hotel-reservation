import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Recommendation = {
  hotelName: string;
  score: number;
  source: "similar" | "popular";
};

// Hotels that currently have at least one available room
async function getBookableHotelNames(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select("hotels!inner(hotel_name)")
    .eq("availability_status", "available");

  const rows = (data ?? []) as unknown as {
    hotels: { hotel_name: string } | null;
  }[];
  return [
    ...new Set(
      rows.map((r) => r.hotels?.hotel_name).filter((n): n is string => !!n)
    ),
  ];
}

export async function getRecommendations(
  startingHotel: string | null,
  limit = 5
): Promise<Recommendation[]> {
  await connection(); // per-request, never prerendered
  const supabase = await createClient();

  // Prefer hotels a customer can book; if none are bookable, use all hotels
  const bookable = await getBookableHotelNames();
  const onlyBookable = bookable.length > 0;

  // Customer with a starting hotel: precomputed hybrid scores
  if (startingHotel) {
    let scoresQuery = supabase
      .from("hotel_scores")
      .select("similar_hotel_name, hybrid_score")
      .eq("hotel_name", startingHotel);
    if (onlyBookable) {
      scoresQuery = scoresQuery.in("similar_hotel_name", bookable);
    }
    const { data } = await scoresQuery
      .order("hybrid_score", { ascending: false })
      .limit(limit);

    if (data && data.length > 0) {
      return data.map((row) => ({
        hotelName: row.similar_hotel_name,
        score: row.hybrid_score,
        source: "similar" as const,
      }));
    }
  }

  // No starting hotel (or no similar hotel found): popularity fallback
  let overallQuery = supabase
    .from("hotel_overall")
    .select("hotel_name, average_rating");
  if (onlyBookable) {
    overallQuery = overallQuery.in("hotel_name", bookable);
  }
  const { data } = await overallQuery
    .order("average_rating", { ascending: false })
    .order("hotel_name", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => ({
    hotelName: row.hotel_name,
    score: row.average_rating,
    source: "popular" as const,
  }));
}

type ReviewWithHotel = {
  rating: number;
  created_at: string;
  bookings: { rooms: { hotels: { hotel_name: string } | null } | null } | null;
};

// Starting hotel = the hotel the customer rated highest (newest review wins ties)
export async function getStartingHotel(userId: string): Promise<string | null> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("rating, created_at, bookings(rooms(hotels(hotel_name)))")
    .eq("user_id", userId)
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const review = (data as unknown as ReviewWithHotel[] | null)?.[0];
  return review?.bookings?.rooms?.hotels?.hotel_name ?? null;
}