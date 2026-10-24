"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ReviewState = { error?: string; message?: string } | null;

export async function submitReview(
  _prevState: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const rating = Number(formData.get("rating"));
  const text = String(formData.get("review_text") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Please choose a rating from 1 to 5." };
  }
  if (text.length > 1000) {
    return { error: "Review text must be 1000 characters or fewer." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  // Row level security decides whether this booking can be reviewed
  const { error } = await supabase.from("reviews").insert({
    booking_id: bookingId,
    user_id: userId,
    rating,
    review_text: text || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You have already reviewed this booking." };
    }
    if (error.code === "42501") {
      return {
        error: "You can only review a confirmed booking after check-out.",
      };
    }
    return { error: "Could not submit your review. Please try again." };
  }

  revalidatePath("/dashboard");
  return { message: "Thank you for your review." };
}