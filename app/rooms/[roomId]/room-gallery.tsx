"use client";

import { useCallback, useEffect, useState } from "react";
import { roomImageUrl } from "@/lib/room-image-url";

type GalleryImage = { image_id: string; image_path: string };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

function ViewerButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PhotoViewer({
  images,
  index,
  alt,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  alt: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const total = images.length;

  const go = useCallback(
    (next: number) => {
      setZoom(MIN_ZOOM);
      onIndexChange((next + total) % total);
    },
    [total, onIndexChange]
  );

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + STEP));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - STEP));

  // Keyboard, and no scrolling of the page behind the viewer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && total > 1) go(index - 1);
      else if (e.key === "ArrowRight" && total > 1) go(index + 1);
      else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(MAX_ZOOM, z + STEP));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(MIN_ZOOM, z - STEP));
      }
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, index, total, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <div className="flex items-center justify-between gap-2 p-3 text-white">
        <span className="text-sm">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <ViewerButton label="Zoom out" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
            −
          </ViewerButton>
          <span className="w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
          <ViewerButton label="Zoom in" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
            +
          </ViewerButton>
          <ViewerButton label="Close" onClick={onClose}>
            ✕
          </ViewerButton>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Bigger than the screen when zoomed, so it can be scrolled to see every part */}
        <div className="absolute inset-0 flex overflow-auto">
          <div
            className="m-auto shrink-0"
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={roomImageUrl(images[index].image_path)}
              alt={`${alt}, photo ${index + 1} of ${total}`}
              draggable={false}
              onDoubleClick={() => setZoom((z) => (z > MIN_ZOOM ? MIN_ZOOM : 2.5))}
              className="h-full w-full cursor-zoom-in object-contain"
            />
          </div>
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/25"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/25"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function RoomGallery({
  images,
  alt,
}: {
  images: GalleryImage[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (images.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground sm:h-96 lg:h-[28rem]">
        No photos yet
      </div>
    );
  }

  const active = Math.min(index, images.length - 1);
  const current = images[active];

  return (
    <div className="flex flex-col gap-3">
      {/* The whole photo is shown, never cropped. Click to open the viewer. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open photo viewer"
        className="relative flex h-72 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-muted sm:h-96 lg:h-[28rem]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={roomImageUrl(current.image_path)}
          alt={`${alt}, photo ${active + 1} of ${images.length}`}
          className="h-full w-full object-contain"
        />
        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
          View larger
        </span>
      </button>

      {images.length > 1 && (
        <ul className="flex snap-x gap-2 overflow-x-auto pb-1">
          {images.map((image, i) => (
            <li key={image.image_id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={`block h-16 w-24 overflow-hidden rounded-lg ring-2 ${
                  i === active ? "ring-primary" : "ring-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={roomImageUrl(image.image_path)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <PhotoViewer
          images={images}
          index={active}
          alt={alt}
          onIndexChange={setIndex}
          onClose={close}
        />
      )}
    </div>
  );
}