import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">{siteConfig.name}</h1>
      <p className="max-w-md text-muted-foreground">{siteConfig.description}</p>
      <Link href="/rooms" className="underline">
        View rooms
      </Link>
    </main>
  );
}