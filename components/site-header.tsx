import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteConfig, type Role } from "@/lib/site-config";
import { accentCss } from "@/lib/brand";
import { getSettings } from "@/lib/settings";
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

  const settings = await getSettings();
  const name = String(settings["brand.name"]);
  const css = accentCss(String(settings["brand.accent"]));
  const isAdmin = role === "hotel_management";

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <NavBar
        brand={isAdmin ? `${name} ${siteConfig.adminSuffix}` : name}
        homeHref={isAdmin ? "/manage" : "/"}
        items={siteConfig.nav[role]}
        signedIn={role !== "guest"}
      />
    </>
  );
}

// Shown while the header loads, so the bar never jumps
export function SiteHeaderFallback() {
  return <div className="mx-auto h-16 max-w-6xl px-4 sm:px-8" />;
}