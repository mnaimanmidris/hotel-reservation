"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type RoomFormState = { error?: string; success?: boolean } | null;

type RoomValues = {
  room_name: string;
  room_type: string;
  price_per_night: number;
  availability_status: string;
};

function parseRoomForm(
  formData: FormData
): { error: string } | { values: RoomValues } {
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

  return {
    values: {
      room_name: roomName,
      room_type: roomType,
      price_per_night: price,
      availability_status: status,
    },
  };
}

export async function addRoom(
  _prevState: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const parsed = parseRoomForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
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

  const { error } = await supabase
    .from("rooms")
    .insert({ hotel_id: hotel.hotel_id, ...parsed.values });

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

export async function updateRoom(
  _prevState: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const roomId = String(formData.get("room_id") ?? "");
  const parsed = parseRoomForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    return { error: "Please log in again." };
  }

  const { data, error } = await supabase
    .from("rooms")
    .update(parsed.values)
    .eq("room_id", roomId)
    .select("room_id");

  if (error) {
    if (error.code === "23505") {
      return { error: "This hotel already has a room with that name." };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Room not found, or you do not manage this hotel." };
  }

  revalidatePath("/manage/rooms");
  revalidatePath("/rooms");
  redirect("/manage/rooms");
}