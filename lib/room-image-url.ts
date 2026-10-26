// Public link of a room photo stored in Supabase Storage
export function roomImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/room-images/${path}`;
}