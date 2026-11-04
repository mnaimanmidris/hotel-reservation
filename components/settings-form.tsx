"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/manage/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKeepingValues } from "@/lib/submit-keep-values";

export type FormSetting = {
  key: string;
  label: string;
  description?: string;
  type: "text" | "number" | "choice";
  multiline?: boolean;
  value: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  choices?: { value: string; label: string; swatch?: string }[];
};

export function SettingsForm({ settings }: { settings: FormSetting[] }) {
  const [state, formAction, pending] = useActionState(saveSettings, null);

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-5">
      {settings.map((setting) => (
        <div key={setting.key} className="flex flex-col gap-2">
          <Label htmlFor={setting.key}>{setting.label}</Label>

          {setting.type === "choice" ? (
            <div role="radiogroup" aria-label={setting.label} className="flex flex-wrap gap-3">
              {setting.choices?.map((choice) => (
                <label
                  key={choice.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/40 has-[:focus-visible]:ring-2"
                >
                  <input
                    type="radio"
                    name={setting.key}
                    value={choice.value}
                    defaultChecked={setting.value === choice.value}
                    className="sr-only"
                  />
                  {choice.swatch && (
                    <span
                      className="size-4 rounded-full"
                      style={{ background: choice.swatch }}
                    />
                  )}
                  {choice.label}
                </label>
              ))}
            </div>
          ) : setting.type === "number" ? (
            <Input
              id={setting.key}
              name={setting.key}
              type="number"
              min={setting.min}
              max={setting.max}
              step="1"
              defaultValue={setting.value}
              required
            />
          ) : setting.multiline ? (
            <textarea
              id={setting.key}
              name={setting.key}
              rows={3}
              maxLength={setting.max}
              defaultValue={String(setting.value)}
              required={setting.required}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
          ) : (
            <Input
              id={setting.key}
              name={setting.key}
              maxLength={setting.max}
              defaultValue={String(setting.value)}
              required={setting.required}
            />
          )}

          {setting.description && (
            <p className="text-xs text-muted-foreground">{setting.description}</p>
          )}
        </div>
      ))}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && (
        <p className="text-sm text-green-700 dark:text-green-400">{state.message}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}