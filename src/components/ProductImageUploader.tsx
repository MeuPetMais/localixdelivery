import { useRef, useState, useCallback } from "react";
import { Camera, ImagePlus, Loader2, Star, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { uploadProductImage, deleteProductImage } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

export type ProductImage = {
  id?: string;
  storage_path: string;
  url: string;
  is_primary: boolean;
  position: number;
  // mark for deletion on save (kept in form state)
  _delete?: boolean;
  // newly added in this session — needs INSERT
  _new?: boolean;
};

type Props = {
  restaurantId: string;
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
};

export function ProductImageUploader({ restaurantId, images, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const visible = images.filter((i) => !i._delete);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const f of list) {
        setProgress(5);
        try {
          const { storage_path, url } = await uploadProductImage(f, restaurantId, setProgress);
          const next: ProductImage = {
            storage_path,
            url,
            is_primary: visible.length === 0,
            position: visible.length,
            _new: true,
          };
          // recompute on next iteration with the updated array
          images = [...images, next];
          onChange([...images]);
          toast.success("Foto enviada");
        } catch (e: any) {
          toast.error(e?.message ?? "Falha no upload");
        } finally {
          setProgress(null);
        }
      }
    },
    [restaurantId, images, visible.length, onChange],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function setPrimary(idx: number) {
    onChange(images.map((img, i) => ({ ...img, is_primary: !img._delete && i === idx })));
  }

  function remove(idx: number) {
    const target = images[idx];
    let next: ProductImage[];
    if (target._new) {
      // never persisted — drop and clean up storage immediately
      deleteProductImage(target.storage_path).catch(() => {});
      next = images.filter((_, i) => i !== idx);
    } else {
      next = images.map((img, i) => (i === idx ? { ...img, _delete: true, is_primary: false } : img));
    }
    // ensure at least one primary among visible
    const stillVisible = next.filter((i) => !i._delete);
    if (stillVisible.length > 0 && !stillVisible.some((i) => i.is_primary)) {
      const firstIdx = next.findIndex((i) => !i._delete);
      next[firstIdx] = { ...next[firstIdx], is_primary: true };
    }
    onChange(next);
  }

  function move(idx: number, dir: -1 | 1) {
    const visibleIdxs = images.map((i, ix) => ({ i, ix })).filter(({ i }) => !i._delete).map(({ ix }) => ix);
    const pos = visibleIdxs.indexOf(idx);
    const swap = visibleIdxs[pos + dir];
    if (swap === undefined) return;
    const next = [...images];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next.map((img, i) => ({ ...img, position: i })));
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {visible.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-2xl border-2 border-dashed p-6 text-center transition",
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          )}
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="h-7 w-7" />
          </div>
          <p className="mt-3 font-semibold">📷 Adicionar foto do produto</p>
          <p className="text-xs text-muted-foreground">ou arraste uma imagem aqui</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
              <ImagePlus className="mr-2 h-4 w-4" /> Escolher arquivo
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()} disabled={progress !== null}>
              <Camera className="mr-2 h-4 w-4" /> Tirar foto
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">PNG, JPG ou WebP · máx. 5 MB</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img, idx) => {
              if (img._delete) return null;
              const visIdx = visible.findIndex((v) => v === img);
              return (
                <div key={img.storage_path} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
                  <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {img.is_primary && (
                    <span className="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      Principal
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                    <button type="button" title="Definir principal" onClick={() => setPrimary(idx)} className="rounded-md bg-white/90 p-1 text-foreground hover:bg-white">
                      <Star className={cn("h-3.5 w-3.5", img.is_primary && "fill-primary text-primary")} />
                    </button>
                    <div className="flex gap-1">
                      <button type="button" title="Mover ←" onClick={() => move(idx, -1)} disabled={visIdx === 0} className="rounded-md bg-white/90 p-1 text-foreground hover:bg-white disabled:opacity-40">
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Mover →" onClick={() => move(idx, 1)} disabled={visIdx === visible.length - 1} className="rounded-md bg-white/90 p-1 text-foreground hover:bg-white disabled:opacity-40">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Remover" onClick={() => remove(idx)} className="rounded-md bg-destructive p-1 text-destructive-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={progress !== null}
              className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <div className="text-center text-xs">
                <ImagePlus className="mx-auto h-5 w-5" />
                <span>Adicionar</span>
              </div>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
              <ImagePlus className="mr-2 h-4 w-4" /> Adicionar mais
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => cameraRef.current?.click()} disabled={progress !== null}>
              <Camera className="mr-2 h-4 w-4" /> Câmera
            </Button>
          </div>
        </>
      )}

      {progress !== null && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Enviando… {progress}%
          </p>
        </div>
      )}
    </div>
  );
}
