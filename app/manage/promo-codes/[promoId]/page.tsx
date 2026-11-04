import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PromoCodeForm } from "../promo-code-form";

export const metadata = { title: "Edit promo code" };

async function EditPromo({ params }: { params: Promise<{ promoId: string }> }) {
  await connection();
  const { promoId } = await params;

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

  // Row level security only returns codes of this manager's own hotel
  const { data: promo } = await supabase
    .from("promo_codes")
    .select(
      "promo_code_id, code, discount_type, discount_value, valid_from, valid_until, max_uses, is_active"
    )
    .eq("promo_code_id", promoId)
    .maybeSingle();

  if (!promo) {
    return <p>Promo code not found, or you do not manage this hotel.</p>;
  }

  return <PromoCodeForm promo={promo} />;
}

export default function EditPromoPage({
  params,
}: {
  params: Promise<{ promoId: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <Link href="/manage/promo-codes" className="text-sm underline">
        Back to promo codes
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Edit promo code</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <EditPromo params={params} />
      </Suspense>
    </main>
  );
}