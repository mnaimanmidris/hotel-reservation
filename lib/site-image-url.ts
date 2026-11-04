// Public link of a banner picture stored in Supabase Storage
export function siteImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-images/${path}`;
}