import { Suspense } from "react";
import { AuthPanels } from "@/components/auth/auth-panels";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Log in or register" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNext(raw);

  // A guest who came from a booking page goes back to it, marked as a guest
  const guestHref = next?.startsWith("/book/")
    ? `${next}${next.includes("?") ? "&" : "?"}guest=1`
    : "/rooms";

  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  return (
    <AuthPanels
      initialTab={tab === "register" ? "register" : "login"}
      next={next ?? ""}
      guestHref={guestHref}
    />
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-1 items-start justify-center p-4 sm:p-8">
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}