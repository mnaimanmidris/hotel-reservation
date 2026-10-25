"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/login/actions";
import type { NavItem } from "@/lib/site-config";

function isActive(pathname: string, href: string) {
  if (href === "/manage") return pathname === "/manage";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar({
  brand,
  homeHref,
  items,
  signedIn,
}: {
  brand: string;
  homeHref: string;
  items: NavItem[];
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-primary"
    >
      {item.label}
    </Link>
  ));

  const logoutForm = signedIn ? (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm">
        Log out
      </Button>
    </form>
  ) : null;

  return (
    <>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        <Link href={homeHref} className="text-lg font-semibold">
          {brand}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links}
          {logoutForm}
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="flex flex-col gap-1 border-t px-4 py-3 md:hidden"
        >
          {links}
          {logoutForm && <div className="px-3 pt-2">{logoutForm}</div>}
        </nav>
      )}
    </>
  );
}