"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { removeHeroImage, uploadHeroImage } from "@/lib/hero-image";
import { siteImageUrl } from "@/lib/site-image-url";

const fileClass =
  "block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1";

export function HeroImageEditor({ path }: { path: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const message = await task();
    if (message) setError(message);
    else router.refresh();
    setBusy(false);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(() => uploadHeroImage(file));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Banner picture</p>

      {path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={siteImageUrl(path)}
          alt="Current banner picture"
          className="aspect-[16/7] w-full rounded-md border object-cover"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No picture yet. The banner uses the plain accent colour.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="hero-image" className="text-sm">
          {path ? "Replace picture" : "Upload picture"}
        </label>
        <input
          id="hero-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={onPick}
          className={fileClass}
        />
      </div>

      {path && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="w-fit"
          onClick={() => {
            if (window.confirm("Remove the banner picture?")) {
              run(removeHeroImage);
            }
          }}
        >
          Remove picture
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        The picture is saved as soon as you choose a file. Use a wide landscape
        photo, at least 1600 px wide. On phones the left and right sides are
        cropped, so keep the main subject near the centre.
      </p>

      {busy && <p className="text-sm">Working...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}