import { Suspense } from "react";
import { connection } from "next/server";
import { RoomCard } from "@/components/room-card";
import {
  bookingLink,
  getRoomCards,
  parseFilters,
  todayInMalaysia,
} from "@/lib/room-listing";
import { RecommendedRooms } from "./recommended-rooms";
import { SearchBar } from "./search-bar";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function RoomsContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const filters = parseFilters(await searchParams);
  const { rooms, error } = await getRoomCards(filters);
  const searching = Boolean(filters.checkIn || filters.guests);

  return (
    <>
      <SearchBar filters={filters} today={todayInMalaysia()} />
      {filters.error && (
        <p className="mb-6 text-sm text-red-600">{filters.error}</p>
      )}

      <Suspense fallback={null}>
        <RecommendedRooms filters={filters} />
      </Suspense>

      <section>
        <h2 className="mb-4 text-xl">
          {searching ? "Matching rooms" : "All rooms"}
        </h2>
        {error ? (
          <p>{error}</p>
        ) : rooms.length === 0 ? (
          <p>
            {searching
              ? "No rooms match your search. Try other dates or fewer guests."
              : "No rooms available yet."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.room_id}
                room={room}
                bookHref={bookingLink(room.room_id, filters)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function RoomsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Rooms</h1>
      <Suspense fallback={<p>Loading rooms...</p>}>
        <RoomsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}