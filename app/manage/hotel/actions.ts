"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type HotelFormState = { error?: string; message?: string } | null;

export async function updateHotel(
  _prevState: HotelFormState,
  formData: FormData
): Promise<HotelFormState> {
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").replace(/[\s-]/g, "");

  if (description.length > 1000) {
    return { error: "The description must be 1000 characters or fewer." };
  }
  if (address.length > 300) {
    return { error: "The address must be 300 characters or fewer." };
  }
  if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return { error: "Please enter a valid contact email address." };
  }
  if (contactPhone && !/^\+[0-9]{8,15}$/.test(contactPhone)) {
    return {
      error: "Contact phone must start with the country code, for example +60312345678.",
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  // Empty fields are stored as empty, not as blank text
  const { data, error } = await supabase
    .from("hotels")
    .update({
      description: description || null,
      address: address || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
    })
    .eq("user_id", userId)
    .select("hotel_id");

  if (error || !data || data.length === 0) {
    return { error: "Could not save the hotel details. Please try again." };
  }

  revalidatePath("/manage/hotel");
  revalidatePath("/manage");
  return { message: "Hotel details saved." };
}