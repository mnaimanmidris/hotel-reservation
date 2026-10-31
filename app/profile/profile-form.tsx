"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

export function ProfileForm({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly />
        <p className="text-xs text-muted-foreground">Your email can't be changed here.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+60123456789"
          pattern="\+[0-9]{8,15}"
          title="Start with the country code, for example +60123456789"
          defaultValue={phone}
          required
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="text-sm text-green-700 dark:text-green-400">{state.message}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving..." : "Save details"}
      </Button>
    </form>
  );
}