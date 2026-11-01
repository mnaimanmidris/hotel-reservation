import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HotelForm } from "./hotel-form";

export const metadata = { title: "Hotel info" };

async function HotelInfo() {
  await connection();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.role !== "hotel_management") {
    notFound();
  }

  const { data: hotel } = await supabase
    .from("hotels")
    .select("hotel_name, description, address, contact_email, contact_phone")
    .eq("user_id", userId)
    .maybeSingle();

  if (!hotel) {
    return (
      <p>
        No hotel is linked to your account yet. Please contact the system
        administrator.
      </p>
    );
  }

  return <HotelForm hotel={hotel} />;
}

export default function HotelInfoPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Hotel info</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <HotelInfo />
      </Suspense>
    </main>
  );
}