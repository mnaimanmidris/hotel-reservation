"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type AddRoomState = { error?: string; success?: boolean } | null;

export async function addRoom(
  _prevState: AddRoomState,
  formData: FormData
): Promise<AddRoomState> {
  const roomName = String(formData.get("room_name") ?? "").trim();
  const roomType = String(formData.get("room_type") ?? "").trim();
  const price = Number(formData.get("price_per_night"));
  const status = String(formData.get("availability_status") ?? "available");

  if (roomName.length < 2) {
    return { error: "Please enter a room name." };
  }
  if (!roomType) {
    return { error: "Please choose a room type." };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Price must be greater than 0." };
  }
  if (!["available", "unavailable"].includes(status)) {
    return { error: "Invalid availability status." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  const { data: hotel } = await supabase
    .from("hotels")
    .select("hotel_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!hotel) {
    return { error: "No hotel is linked to your account." };
  }

  const { error } = await supabase.from("rooms").insert({
    hotel_id: hotel.hotel_id,
    room_name: roomName,
    room_type: roomType,
    price_per_night: price,
    availability_status: status,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This hotel already has a room with that name." };
    }
    return { error: error.message };
  }

  revalidatePath("/manage/rooms");
  revalidatePath("/rooms");
  return { success: true };
}