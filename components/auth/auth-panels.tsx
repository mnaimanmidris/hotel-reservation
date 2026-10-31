"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

type Tab = "login" | "register";

const panel = "flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10";

export function AuthPanels({
  initialTab,
  next,
  guestHref,
}: {
  initialTab: Tab;
  next: string;
  guestHref: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 px-3 py-2 text-sm ${
      active
        ? "border-primary font-medium text-primary"
        : "border-transparent text-muted-foreground"
    }`;

  return (
    <div className="w-full max-w-4xl">
      {/* Tabs on a phone; both cards show side by side on a wider screen */}
      <div role="tablist" className="mb-4 flex border-b md:hidden">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          className={tabClass(tab === "login")}
          onClick={() => setTab("login")}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "register"}
          className={tabClass(tab === "register")}
          onClick={() => setTab("register")}
        >
          Register
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <section className={`${panel} ${tab === "login" ? "flex" : "hidden md:flex"}`}>
          <h2 className="text-center text-lg font-medium">Log in</h2>
          <LoginForm next={next} />
          <p className="text-center text-sm text-muted-foreground">or</p>
          <Link href={guestHref} className={buttonVariants({ variant: "outline" })}>
            Continue as guest
          </Link>
        </section>

        <section className={`${panel} ${tab === "register" ? "flex" : "hidden md:flex"}`}>
          <h2 className="text-center text-lg font-medium">Register</h2>
          <RegisterForm />
        </section>
      </div>
    </div>
  );
}