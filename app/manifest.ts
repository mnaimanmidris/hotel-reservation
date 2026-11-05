import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { ACCENTS } from "@/lib/brand";
import { getSettings } from "@/lib/settings";

// The installed app takes its name and colour from the branding settings
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const settings = await getSettings();
  const name = String(settings["brand.name"]);
  const tagline = String(settings["brand.tagline"]);
  const accent =
    ACCENTS.find((a) => a.value === settings["brand.accent"]) ?? ACCENTS[0];

  return {
    id: "/",
    name,
    short_name: name.slice(0, 12).trim(),
    description: tagline || name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: accent.swatch,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}