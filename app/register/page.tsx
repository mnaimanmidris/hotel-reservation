"use client";

import { useActionState } from "react";
import { register } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

export default function RegisterPage() {
    const [state, formAction, pending] = useActionState(register, null);

    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Create an account</CardTitle>
                    <CardDescription>
                        Register to book rooms and get hotel recommendations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {state?.success ? (
                        <p>Account created. Please check your email to confirm your address, then log in. </p>
                    ) : (
                        <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="full_name">Full name</Label>
                                <Input id="full_name" name="full_name" placeholder="Ahmad Ali" title="Enter your full name."required />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="name@example.com" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Enter a valid email address, for example name@example.com." required />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="phone_number">Phone number</Label>
                                <div className="flex gap-2">
                                    <select name="country_code" defaultValue="+60" aria-label="Country code" className="h-9 rounded-md border bg-transparent px-2 text-sm">
                                        <option value="+60">Malaysia (+60)</option>
                                        <option value="+65">Singapore (+65)</option>
                                        <option value="+62">Indonesia (+62)</option>
                                        <option value="+673">Brunei (+673)</option>
                                        <option value="+66">Thailand (+66)</option>
                                    </select>
                                    <Input id="phone_number" name="phone_number" type="tel" inputMode="numeric" placeholder="123456789" pattern="[0-9\- ]{7,14}" title="Digits only, without the country code (for example 123456789)." required />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type="password" minLength={8} title="Enter your password." required />
                            </div>

                            {state?.error && (
                                <p className="text-sm text-red-600">{state.error}</p>
                            )}

                            <Button type="submit" disabled={pending}>
                                {pending ? "Creating account..." : "Register"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
