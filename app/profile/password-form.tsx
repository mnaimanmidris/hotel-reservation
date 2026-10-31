"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current_password">Current password</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new_password">New password</Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="text-sm text-green-700 dark:text-green-400">{state.message}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Changing..." : "Change password"}
      </Button>
    </form>
  );
}