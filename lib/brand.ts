export type AccentChoice = "blue" | "green" | "teal" | "rose" | "amber";

export const ACCENTS: { value: AccentChoice; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "green", label: "Green", swatch: "#16a34a" },
  { value: "teal", label: "Teal", swatch: "#0d9488" },
  { value: "rose", label: "Rose", swatch: "#e11d48" },
  { value: "amber", label: "Amber", swatch: "#d97706" },
];

// Colours for each theme, built from one hue so the text stays readable
function makePalette(hue: number, chroma = 0.13) {
  return {
    light: {
      primary: `oklch(0.55 ${chroma} ${hue})`,
      accent: `oklch(0.935 0.03 ${hue})`,
      "accent-foreground": `oklch(0.3 0.06 ${hue})`,
      ring: `oklch(0.65 0.1 ${hue})`,
    },
    dark: {
      primary: `oklch(0.74 ${chroma} ${hue})`,
      "primary-foreground": `oklch(0.2 0.03 ${hue})`,
      accent: `oklch(0.31 0.04 ${hue})`,
      "accent-foreground": "oklch(0.93 0.005 260)",
      ring: `oklch(0.6 0.09 ${hue})`,
    },
  };
}

const PALETTES: Record<string, ReturnType<typeof makePalette>> = {
  green: makePalette(150),
  teal: makePalette(195, 0.1),
  rose: makePalette(15, 0.17),
  amber: makePalette(60),
};

// Blue is the built-in default, so it needs no extra CSS
export function accentCss(accent: string): string | null {
  const palette = PALETTES[accent];
  if (!palette) return null;
  const block = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([name, value]) => `--${name}:${value}`)
      .join(";");
  return `:root{${block(palette.light)}}.dark{${block(palette.dark)}}`;
}