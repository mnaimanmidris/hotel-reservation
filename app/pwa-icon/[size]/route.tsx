import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { ACCENTS } from "@/lib/brand";
import { getSettings } from "@/lib/settings";

// App icon: the hotel's initials on its accent colour, so it follows the branding
export async function GET(
  _request: Request,
  ctx: RouteContext<"/pwa-icon/[size]">
) {
  await connection();
  const { size } = await ctx.params;
  const px = size === "192" ? 192 : size === "512" ? 512 : null;
  if (!px) {
    return new Response("Not found", { status: 404 });
  }

  const settings = await getSettings();
  const name = String(settings["brand.name"]).trim();
  const accent =
    ACCENTS.find((a) => a.value === settings["brand.accent"]) ?? ACCENTS[0];

  const initials =
    name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "H";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent.swatch,
          color: "#ffffff",
          fontSize: px * 0.42,
          fontWeight: 700,
        }}
      >
        {initials}
      </div>
    ),
    { width: px, height: px }
  );
}