"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  MAX_IMAGES,
  deleteRoomImage,
  makeMainImage,
  uploadRoomImages,
} from "@/lib/room-images";
import { roomImageUrl } from "@/lib/room-image-url";

type RoomImage = { image_id: string; image_path: string; sort_order: number };

const fileClass =
  "block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1";

export function RoomPhotos({
  roomId,
  images,
}: {
  roomId: string;
  images: RoomImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`A room can have at most ${MAX_IMAGES} photos.`);
      return;
    }
    await run(() => uploadRoomImages(roomId, files));
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h2 className="text-lg font-medium">Photos</h2>

      <p className="text-sm text-muted-foreground">
        Photos are saved as soon as you add, delete or reorder them. Save
        changes below applies to the room details.
      </p>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.image_id} className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={roomImageUrl(image.image_path)}
                alt={`Room photo ${index + 1}`}
                className="aspect-video w-full rounded-md border object-cover"
              />
              <div className="flex flex-wrap items-center gap-2">
                {index === 0 ? (
                  <span className="text-xs font-medium text-primary">Main photo</span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(() => makeMainImage(image.image_id, images[0].sort_order))
                    }
                  >
                    Make main
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this photo?")) {
                      run(() => deleteRoomImage(image));
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {images.length < MAX_IMAGES && (
        <div className="flex flex-col gap-2">
          <label htmlFor="add-photos" className="text-sm">
            Add photos ({images.length} of {MAX_IMAGES})
          </label>
          <input
            ref={inputRef}
            id="add-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={onPick}
            className={fileClass}
          />
        </div>
      )}

      {busy && <p className="text-sm">Working...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}