import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SETTING_DEFS, getSettings, type SettingDef } from "@/lib/settings";
import { SettingsForm, type FormSetting } from "@/components/settings-form";
import { HeroImageEditor } from "@/components/hero-image-editor";

export const metadata = { title: "Settings" };

async function SettingsContent() {
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

  const values = await getSettings();
  const editable = SETTING_DEFS.filter(
    (def) => def.group === "brand" && def.tier === "staff" && !def.managed
  );
  const toForm = (def: SettingDef): FormSetting => ({
    key: def.key,
    multiline: def.multiline,
    label: def.label,
    description: def.description,
    type: def.type,
    value: values[def.key],
    required: def.required,
    min: def.min,
    max: def.max,
    choices: def.choices,
  });
  const sections = ["Branding", "Home page", "Footer"].map((title) => ({
    title,
    settings: editable
      .filter((def) => (def.section ?? "Branding") === title)
      .map(toForm),
  }));

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section
          key={section.title}
          className="flex max-w-xl flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
        >
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.title === "Home page" && (
            <HeroImageEditor path={String(values["brand.hero_image"])} />
          )}
          <SettingsForm settings={section.settings} />
        </section>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}