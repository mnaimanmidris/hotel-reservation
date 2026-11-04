import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/room-images";
import { setHeroImage } from "@/app/manage/settings/actions";

const BUCKET = "site-images";
const MAX_SIDE = 1920;

// Returns an error message, or null when everything worked
export async function uploadHeroImage(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return `${file.name} is not an image.`;
  }

  let blob: Blob;
  try {
    blob = await compressImage(file, MAX_SIDE);
  } catch {
    return `Could not read ${file.name}. Try a JPEG, PNG or WebP photo.`;
  }

  const extension = blob.type === "image/jpeg" ? "jpg" : "webp";
  const path = `hero/${crypto.randomUUID()}.${extension}`;

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type });
  if (uploadError) return uploadError.message;

  const result = await setHeroImage(path);
  if (result.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return result.error;
  }
  return null;
}

export async function removeHeroImage(): Promise<string | null> {
  const result = await setHeroImage("");
  return result.error ?? null;
}