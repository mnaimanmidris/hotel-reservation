"use server";

import { createClient } from "@/lib/supabase/server";

type BookingState =
  | { error: string }
  | {
      summary: {
        nights: number;
        total: number;
        checkIn: string;
        checkOut: string;
      };
    }
  | null;

const DAY = 24 * 60 * 60 * 1000;

export async function startBooking(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const roomId = String(formData.get("room_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  const guestName = String(formData.get("guest_name") ?? "").trim();
  const guestEmail = String(formData.get("guest_email") ?? "").trim().toLowerCase();
  const guestPhone = String(formData.get("guest_phone") ?? "").replace(/[\s-]/g, "");

  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(checkIn) || !dateFormat.test(checkOut)) {
    return { error: "Please choose your check-in and check-out dates." };
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  if (checkIn < today) {
    return { error: "Check-in cannot be in the past." };
  }
  if (checkOut <= checkIn) {
    return { error: "Check-out must be after check-in." };
  }

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
  if (nights > 30) {
    return { error: "The longest stay is 30 nights." };
  }

  if (guestName.length < 2) {
    return { error: "Please enter the guest name." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) {
    return { error: "Please enter a valid email address." };
  }
    if (!/^\+[0-9]{8,15}$/.test(guestPhone)) {
    return { error: "Please enter your phone number with the country code, for example +60123456789." };
  }

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("price_per_night, availability_status")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!room || room.availability_status !== "available") {
    return { error: "This room is not available." };
  }

  return {
    summary: {
      nights,
      total: nights * Number(room.price_per_night),
      checkIn,
      checkOut,
    },
  };
}