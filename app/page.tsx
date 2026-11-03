import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getSettings } from "@/lib/settings";

async function HomeContent() {
  await connection();
  const settings = await getSettings();

  return (
    <>
      <h1 className="text-3xl font-semibold">{String(settings["brand.name"])}</h1>
      <p className="max-w-md text-muted-foreground">
        {String(settings["brand.tagline"])}
      </p>
      <Link href="/rooms" className="underline">
        View rooms
      </Link>
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <Suspense fallback={null}>
        <HomeContent />
      </Suspense>
    </main>
  );
}