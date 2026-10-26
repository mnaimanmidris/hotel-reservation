import { createClient } from "@/lib/supabase/client";

const BUCKET = "room-images";
const MAX_SIDE = 1600;

// Moves into the settings table in step S1
export const MAX_IMAGES = 8;

async function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, 0.8)
  );
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob = await toBlob(canvas, "image/webp");
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg");
  }
  if (!blob) throw new Error("Could not compress the image.");
  return blob;
}

// Returns an error message, or null when everything worked
export async function uploadRoomImages(
  roomId: string,
  files: File[]
): Promise<string | null> {
  const supabase = createClient();

  const { data: last } = await supabase
    .from("room_images")
    .select("sort_order")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let order = (last?.[0]?.sort_order ?? -1) + 1;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return `${file.name} is not an image.`;
    }

    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      return `Could not read ${file.name}. Try a JPEG, PNG or WebP photo.`;
    }

    const extension = blob.type === "image/jpeg" ? "jpg" : "webp";
    const path = `${roomId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type });
    if (uploadError) return uploadError.message;

    const { error: rowError } = await supabase
      .from("room_images")
      .insert({ room_id: roomId, image_path: path, sort_order: order });
    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return rowError.message;
    }
    order += 1;
  }
  return null;
}

export async function deleteRoomImage(image: {
  image_id: string;
  image_path: string;
}): Promise<string | null> {
  const supabase = createClient();

  const { data, error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([image.image_path]);
  if (storageError) return storageError.message;
  if (!data || data.length === 0) return "Could not delete the photo file.";

  const { error } = await supabase
    .from("room_images")
    .delete()
    .eq("image_id", image.image_id);
  return error ? error.message : null;
}

export async function makeMainImage(
  imageId: string,
  currentFirstOrder: number
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("room_images")
    .update({ sort_order: currentFirstOrder - 1 })
    .eq("image_id", imageId)
    .select("image_id");
  if (error) return error.message;
  if (!data || data.length === 0) return "Could not change the main photo.";
  return null;
}