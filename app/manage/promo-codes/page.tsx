import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { DeletePromoButton, TogglePromoButton } from "./promo-code-buttons";

export const metadata = { title: "Promo codes" };

type PromoRow = {
  promo_code_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  is_active: boolean;
};

const GREEN = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
const GRAY = "bg-muted text-muted-foreground";

function discountText(p: PromoRow) {
  const value = Number(p.discount_value);
  return p.discount_type === "percent"
    ? `${value}% off`
    : `RM ${value.toFixed(2)} off`;
}

function validityText(p: PromoRow) {
  if (!p.valid_from && !p.valid_until) return "No date limit";
  if (p.valid_from && p.valid_until) return `${p.valid_from} to ${p.valid_until}`;
  return p.valid_from ? `From ${p.valid_from}` : `Until ${p.valid_until}`;
}

async function ManagePromoCodes() {
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
    .select("hotel_id, hotel_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!hotel) {
    return <p>No hotel is linked to your account yet.</p>;
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "promo_code_id, code, discount_type, discount_value, valid_from, valid_until, max_uses, is_active"
    )
    .eq("hotel_id", hotel.hotel_id)
    .order("created_at", { ascending: false });
  if (error) {
    return <p>Could not load promo codes: {error.message}</p>;
  }

  const promos = (data ?? []) as PromoRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{hotel.hotel_name}</h2>
        <Link href="/manage/promo-codes/new" className={buttonVariants()}>
          Add promo code
        </Link>
      </div>

      {promos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No promo codes yet. You can keep several active at the same time, for
          example a New Year code and a 1 January code with different dates.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {promos.map((p) => (
            <article
              key={p.promo_code_id}
              className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono font-medium">{p.code}</h3>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      p.is_active ? GREEN : GRAY
                    }`}
                  >
                    {p.is_active ? "Active" : "Off"}
                  </span>
                </div>
                <p className="text-sm">{discountText(p)}</p>
                <p className="text-xs text-muted-foreground">
                  {validityText(p)}
                  {p.max_uses ? ` · at most ${p.max_uses} uses` : " · no use limit"}
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-2">
                <TogglePromoButton promoId={p.promo_code_id} active={p.is_active} />
                <Link
                  href={`/manage/promo-codes/${p.promo_code_id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
                </Link>
                <DeletePromoButton promoId={p.promo_code_id} code={p.code} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManagePromoCodesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Promo codes</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <ManagePromoCodes />
      </Suspense>
    </main>
  );
}