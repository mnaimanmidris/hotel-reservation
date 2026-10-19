import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export async function AuthStatus() {
  await connection();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  const userId = data?.claims?.sub;

  if (!email || !userId) {
    return (
      <div className="flex gap-4 text-sm">
        <Link href="/login" className="underline">Log in</Link>
        <Link href="/register" className="underline">Register</Link>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const isManager = profile?.role === "hotel_management";

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <Link href={isManager ? "/manage/rooms" : "/dashboard"} className="underline">
        {isManager ? "Manage rooms" : "My bookings"}
      </Link>
      <span>{email}</span>
      <form action={logout}>
        <Button type="submit" variant="outline">Log out</Button>
      </form>
    </div>
  );
}