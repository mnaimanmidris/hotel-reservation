import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PromoCodeForm } from "../promo-code-form";

export const metadata = { title: "Add promo code" };

async function AddPromo() {
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

  return <PromoCodeForm />;
}

export default function AddPromoPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <Link href="/manage/promo-codes" className="text-sm underline">
        Back to promo codes
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Add promo code</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <AddPromo />
      </Suspense>
    </main>
  );
}