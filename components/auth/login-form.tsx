"use client";

import { useActionState } from "react";
import { login } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="login_email">Email</Label>
        <Input
          id="login_email"
          name="email"
          type="email"
          placeholder="name@example.com"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login_password">Password</Label>
        <Input id="login_password" name="password" type="password" required />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}