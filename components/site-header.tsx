import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteConfig, type Role } from "@/lib/site-config";
import { NavBar } from "@/components/nav-bar";

export async function SiteHeader() {
  await connection();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  let role: Role = "guest";
  if (userId) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    role = profile?.role === "hotel_management" ? "hotel_management" : "customer";
  }

  const isAdmin = role === "hotel_management";
  return (
    <NavBar
      brand={isAdmin ? `${siteConfig.name} ${siteConfig.adminSuffix}` : siteConfig.name}
      homeHref={isAdmin ? "/manage" : "/"}
      items={siteConfig.nav[role]}
      signedIn={role !== "guest"}
    />
  );
}

// Shown while the header loads, so the bar never jumps
export function SiteHeaderFallback() {
  return (
    <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-8">
      <span className="text-lg font-semibold">{siteConfig.name}</span>
    </div>
  );
}