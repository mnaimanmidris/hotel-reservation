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

  if (!email) {
    return (
      <div className="flex gap-4 text-sm">
        <Link href="/login" className="underline">Log in</Link>
        <Link href="/register" className="underline">Register</Link>
      </div>
    );
  }

  return (
    <form action={logout} className="flex items-center gap-2">
      <span className="text-sm">{email}</span>
      <Button type="submit" variant="outline">Log out</Button>
    </form>
  );
}