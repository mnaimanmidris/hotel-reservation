import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Appearance } from "./appearance";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

const panel =
  "flex max-w-xl flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10";

async function ProfileContent() {
  await connection();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, phone, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.role === "hotel_management") {
    redirect("/manage");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={panel}>
        <h2 className="text-lg font-medium">Personal details</h2>
        <ProfileForm
          fullName={profile?.full_name ?? ""}
          email={profile?.email ?? ""}
          phone={profile?.phone ?? ""}
        />
      </section>

      <section className={panel}>
        <h2 className="text-lg font-medium">Password</h2>
        <PasswordForm />
      </section>

      <section className={panel}>
        <h2 className="text-lg font-medium">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Follow your device, or choose light or dark. Your choice is kept on this browser.
        </p>
        <Appearance />
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Profile</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}