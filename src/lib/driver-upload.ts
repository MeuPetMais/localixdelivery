import { supabase } from "@/integrations/supabase/client";

const BUCKET = "restaurant-assets";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1600;
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function compressToWebp(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.type === "image/gif" || file.type === "application/pdf") return file;
  try {
    const img = await loadImage(file);
    let { width, height } = img;
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export type DriverAssetKind = "photo" | "cnh" | "document";

export async function uploadDriverAsset(
  file: File,
  restaurantId: string,
  kind: DriverAssetKind,
): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 5 MB.");
  const isImage = file.type.startsWith("image/");
  const blob = isImage ? await compressToWebp(file) : file;
  const ext =
    blob.type === "image/webp"
      ? "webp"
      : file.name.split(".").pop()?.toLowerCase() ?? (isImage ? "jpg" : "bin");
  const path = `${restaurantId}/drivers/${kind}-${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    upsert: false,
    contentType: blob.type,
  });
  if (upErr) throw upErr;

  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (sErr || !signed) throw sErr ?? new Error("Falha ao gerar URL.");
  return signed.signedUrl;
}
