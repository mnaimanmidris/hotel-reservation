"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type RoomFormState = { error?: string; success?: boolean; roomId?: string } | null;

type RoomValues = {
  room_name: string;
  room_type: string;
  quantity: number;
  price_per_night: number;
  availability_status: string;
  max_guests: number;
};

function parseRoomForm(
  formData: FormData
): { error: string } | { values: RoomValues } {
  const roomName = String(formData.get("room_name") ?? "").trim();
  const roomType = String(formData.get("room_type") ?? "").trim();
  const price = Number(formData.get("price_per_night"));
  const status = String(formData.get("availability_status") ?? "available");
  const maxGuests = Number(formData.get("max_guests"));
  const quantity = Number(formData.get("quantity"));

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
  if (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 20) {
    return { error: "Maximum guests must be a whole number from 1 to 20." };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    return { error: "Number of rooms must be a whole number from 1 to 500." };
  }

  return {
    values: {
      room_name: roomName,
      room_type: roomType,
      quantity: quantity,
      price_per_night: price,
      availability_status: status,
      max_guests: maxGuests,
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

  const { data: created, error } = await supabase
    .from("rooms")
    .insert({ hotel_id: hotel.hotel_id, ...parsed.values })
    .select("room_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "This hotel already has a room with that name." };
    }
    return { error: error.message };
  }

  revalidatePath("/manage/rooms");
  revalidatePath("/rooms");
  return { success: true, roomId: created.room_id };
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

export async function deleteRoom(
  _prevState: RoomFormState,
  formData: FormData
): Promise<RoomFormState> {
  const roomId = String(formData.get("room_id") ?? "");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    return { error: "Please log in again." };
  }

  const { data: photos } = await supabase
    .from("room_images")
    .select("image_path")
    .eq("room_id", roomId);

  const { data, error } = await supabase
    .from("rooms")
    .delete()
    .eq("room_id", roomId)
    .select("room_id");

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This room has bookings, so it cannot be deleted. Set it to Unavailable instead.",
      };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Room not found, or you do not manage this hotel." };
  }

  if (photos && photos.length > 0) {
    await supabase.storage
      .from("room-images")
      .remove(photos.map((photo) => photo.image_path));
  }

  revalidatePath("/manage/rooms");
  revalidatePath("/rooms");
  return { success: true };
}