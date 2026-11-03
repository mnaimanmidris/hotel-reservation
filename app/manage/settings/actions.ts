"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SETTING_DEFS, getSettings, parseSettingValue } from "@/lib/settings";

type SettingsState = { error?: string; message?: string } | null;

export async function saveSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = profile?.role;
  if (role !== "hotel_management" && role !== "system_admin") {
    return { error: "You do not have access to these settings." };
  }

  const current = await getSettings();
  const changes: { key: string; label: string; oldValue: string | number; value: string | number }[] = [];

  for (const def of SETTING_DEFS) {
    if (!formData.has(def.key)) continue;
    if (def.tier === "pic" && role !== "system_admin") continue;

    const parsed = parseSettingValue(def, String(formData.get(def.key) ?? ""));
    if ("error" in parsed) {
      return { error: `${def.label} ${parsed.error}` };
    }
    if (parsed.value !== current[def.key]) {
      changes.push({
        key: def.key,
        label: def.label,
        oldValue: current[def.key],
        value: parsed.value,
      });
    }
  }

  if (changes.length === 0) {
    return { message: "Nothing to save. No setting was changed." };
  }

  const admin = createAdminClient();
  for (const change of changes) {
    const { data, error } = await supabase
      .from("site_settings")
      .update({
        value: change.value,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("key", change.key)
      .select("key");

    if (error || !data || data.length === 0) {
      return { error: `Could not save "${change.label}".` };
    }

    const { error: logError } = await admin.from("audit_log").insert({
      actor_id: userId,
      action: "setting.update",
      target: change.key,
      old_value: change.oldValue,
      new_value: change.value,
    });
    if (logError) console.error("Audit log failed:", logError.message);
  }

  revalidatePath("/", "layout");
  return { message: "Settings saved." };
}