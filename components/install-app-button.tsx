"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void> };

// These facts about the browser never change while the page is open
const neverChanges = () => () => {};
const readInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const readIsIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

// Shows an "Install app" button when the browser can install this site.
// Chrome and Edge give us a prompt to open. On iPhone and iPad the person adds
// it from the Share menu, so we show those steps instead.
export function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const alreadyInstalled = useSyncExternalStore(neverChanges, readInstalled, () => false);
  const isIos = useSyncExternalStore(neverChanges, readIsIos, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setJustInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (alreadyInstalled || justInstalled || (!installEvent && !isIos)) return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (installEvent) installEvent.prompt();
          else setShowSteps((open) => !open);
        }}
      >
        Install app
      </Button>
      {showSteps && !installEvent && (
        <p className="max-w-xs text-xs text-muted-foreground">
          Tap the Share button in Safari, then choose Add to Home Screen.
        </p>
      )}
    </div>
  );
}