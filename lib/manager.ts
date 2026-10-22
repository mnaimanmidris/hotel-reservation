import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getManagerContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.role !== "hotel_management") {
    return null;
  }

  const { data: hotel } = await supabase
    .from("hotels")
    .select("hotel_id, hotel_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!hotel) {
    return null;
  }

  return {
    userId,
    hotelId: hotel.hotel_id as string,
    hotelName: hotel.hotel_name as string,
  };
}