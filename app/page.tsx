import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";
import { siteImageUrl } from "@/lib/site-image-url";

async function HomeContent() {
  await connection();
  const settings = await getSettings();
  const name = String(settings["brand.name"]);
  const tagline = String(settings["brand.tagline"]);
  const heroImage = String(settings["brand.hero_image"]);

  const reasons = [1, 2, 3]
    .map((n) => ({
      title: String(settings[`home.reason${n}_title`]).trim(),
      text: String(settings[`home.reason${n}_text`]).trim(),
    }))
    .filter((reason) => reason.title);

  return (
    <>
      <section
        className={cn(
          "relative isolate overflow-hidden",
          heroImage ? "bg-accent text-white" : "bg-accent text-accent-foreground"
        )}
      >
        {heroImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(heroImage)}
              alt=""
              fetchPriority="high"
              className="absolute inset-0 -z-20 size-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-black/55 sm:bg-black/0 sm:bg-linear-to-r sm:from-black/70 sm:via-black/50 sm:to-black/20"
            />
          </>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-primary/15 sm:size-[28rem]"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 -left-16 -z-10 size-64 rounded-full bg-primary/10 sm:size-96"
            />
          </>
        )}
        <div className="mx-auto flex min-h-[22rem] w-full max-w-6xl flex-col justify-center gap-5 px-4 py-16 sm:min-h-[30rem] sm:px-8">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {name}
          </h1>
          {tagline && (
            <p className="max-w-2xl text-lg text-balance opacity-90 sm:text-xl">
              {tagline}
            </p>
          )}
          <div>
            <Link
              href="/rooms"
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-base")}
            >
              Browse rooms
            </Link>
          </div>
        </div>
      </section>

      {reasons.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {reasons.map((reason, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10"
              >
                <h2 className="font-medium">{reason.title}</h2>
                {reason.text && (
                  <p className="text-sm text-muted-foreground">{reason.text}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <HomeContent />
      </Suspense>
    </main>
  );
}