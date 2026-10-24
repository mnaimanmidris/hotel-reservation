import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations, getStartingHotel } from "@/lib/recommendations";

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

  const similar = recommendations[0].source === "similar";

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl">
        {similar ? `Similar to ${startingHotel}` : "Popular hotels"}
      </h2>
      <ul className="list-disc pl-5 text-sm">
        {recommendations.map((r) => (
          <li key={r.hotelName}>{r.hotelName}</li>
        ))}
      </ul>
    </section>
  );
}