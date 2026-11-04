import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Writes one line to the audit log. A failure is logged but never blocks the action.
export async function logAudit(entry: {
  actorId: string;
  action: string;
  target: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target: entry.target,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
  });
  if (error) console.error("Audit log failed:", error.message);
}