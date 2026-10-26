// Public link of a room photo stored in Supabase Storage
export function roomImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/room-images/${path}`;
}

// The cover photo is the image with the lowest sort order (null if none)
export function coverImagePath(
  images: { image_path: string; sort_order: number }[] | null
) {
  if (!images || images.length === 0) return null;
  return [...images].sort((a, b) => a.sort_order - b.sort_order)[0].image_path;
}