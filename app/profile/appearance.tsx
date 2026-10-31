"use client";

import { Button } from "@/components/ui/button";
import { setTheme, useTheme, type Theme } from "@/components/theme-toggle";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "Device setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function Appearance() {
  const theme = useTheme();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={theme === option.value ? "default" : "outline"}
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}