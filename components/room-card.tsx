import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { roomImageUrl } from "@/lib/room-image-url";
import type { RoomCardData } from "@/lib/room-listing";

export function RoomCard({
  room,
  bookHref,
  recommended = false,
}: {
  room: RoomCardData;
  bookHref: string;
  recommended?: boolean;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
      {room.coverPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomImageUrl(room.coverPath)}
          alt={`${room.room_name} at ${room.hotel_name}`}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No photo yet
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {recommended && (
          <span className="w-fit rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            Recommended
          </span>
        )}
        <h3 className="font-medium">{room.room_name}</h3>
        <p className="text-sm text-muted-foreground">
          {room.hotel_name} · {room.room_type}
        </p>
        <p className="text-sm text-muted-foreground">
          Up to {room.max_guests} guest{room.max_guests === 1 ? "" : "s"}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            <p className="text-lg font-semibold">
              RM {room.price_per_night.toFixed(2)}{" "}
              <span className="text-sm font-normal text-muted-foreground">/ night</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {room.rating
                ? `★ ${room.rating.average.toFixed(1)} (${room.rating.count})`
                : "No reviews yet"}
            </p>
          </div>
          {room.available ? (
            <Link href={bookHref} className={buttonVariants({ size: "sm" })}>
              Book now
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Unavailable</span>
          )}
        </div>
      </div>
    </article>
  );
}