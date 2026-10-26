import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RoomFilters } from "@/lib/room-listing";

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function SearchBar({
  filters,
  today,
}: {
  filters: RoomFilters;
  today: string;
}) {
  const active = Boolean(filters.checkIn || filters.guests);

  return (
    <form
      action="/rooms"
      method="get"
      className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_auto] lg:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="check_in">Check-in</Label>
        <input
          id="check_in"
          name="check_in"
          type="date"
          min={today}
          defaultValue={filters.checkIn}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="check_out">Check-out</Label>
        <input
          id="check_out"
          name="check_out"
          type="date"
          min={today}
          defaultValue={filters.checkOut}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guests">Guests</Label>
        <input
          id="guests"
          name="guests"
          type="number"
          min="1"
          max="20"
          step="1"
          placeholder="Any"
          defaultValue={filters.guests}
          className={fieldClass}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">Search</Button>
        {active && (
          <Link href="/rooms" className="text-sm underline">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}