import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1600;
const BUCKET = "product-images";
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
  // SVG / animated gif: keep as-is
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
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

export async function uploadProductImage(
  file: File,
  restaurantId: string,
  onProgress?: (pct: number) => void,
): Promise<{ storage_path: string; url: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > MAX_BYTES) throw new Error("Imagem maior que 5 MB. Escolha uma menor.");

  onProgress?.(10);
  const blob = await compressToWebp(file);
  onProgress?.(45);

  const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    upsert: false,
    contentType: blob.type,
  });
  if (upErr) throw upErr;
  onProgress?.(80);

  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (sErr || !signed) throw sErr ?? new Error("Falha ao gerar URL.");
  onProgress?.(100);

  return { storage_path: path, url: signed.signedUrl };
}

export async function deleteProductImage(storagePath: string): Promise<void> {
  if (!storagePath) return;
  await supabase.storage.from(BUCKET).remove([storagePath]);
}
