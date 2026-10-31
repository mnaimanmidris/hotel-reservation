"use client";

import { useActionState } from "react";
import { register } from "@/app/register/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, null);

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="register_full_name">Full name</Label>
        <Input
          id="register_full_name"
          name="full_name"
          placeholder="Ahmad Ali"
          title="Enter your full name."
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register_email">Email</Label>
        <Input
          id="register_email"
          name="email"
          type="email"
          placeholder="name@example.com"
          pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
          title="Enter a valid email address, for example name@example.com."
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register_phone">Phone number</Label>
        <div className="flex gap-2">
          <select
            name="country_code"
            defaultValue="+60"
            aria-label="Country code"
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="+60">Malaysia (+60)</option>
            <option value="+65">Singapore (+65)</option>
            <option value="+62">Indonesia (+62)</option>
            <option value="+673">Brunei (+673)</option>
            <option value="+66">Thailand (+66)</option>
          </select>
          <Input
            id="register_phone"
            name="phone_number"
            type="tel"
            inputMode="numeric"
            placeholder="123456789"
            pattern="[0-9\- ]{7,14}"
            title="Digits only, without the country code (for example 123456789)."
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register_password">Password</Label>
        <Input
          id="register_password"
          name="password"
          type="password"
          minLength={8}
          title="At least 8 characters."
          required
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account..." : "Register"}
      </Button>
    </form>
  );
}