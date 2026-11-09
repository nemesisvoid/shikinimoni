"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_MEDIA_PER_PROPERTY } from "@/schemas/media.schema";
import type { PhotoItem, StagedPhoto } from "./upload-files";

const MAX_MB = MAX_IMAGE_BYTES / 1024 / 1024;
const ACCEPT = IMAGE_MIME_TYPES.join(",");

/**
 * Pick, preview, order and describe photos. The first photo is the cover. On the
 * edit page, saved photos sit in the same list as new ones; nothing changes in
 * storage until the property is saved.
 */
export function PhotoPicker({
  photos,
  onChange,
  disabled,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  // Free the blob: URLs when the form goes away.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  useEffect(() => () => latest.current.forEach((p) => p.kind === "new" && URL.revokeObjectURL(p.previewUrl)), []);

  async function addFiles(files: File[]) {
    const problems: string[] = [];
    const room = MAX_MEDIA_PER_PROPERTY - photos.length;
    const accepted: File[] = [];
    for (const file of files) {
      if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        problems.push(`${file.name}: use a JPEG, PNG, WebP or AVIF image.`);
      } else if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`${file.name}: larger than ${MAX_MB} MB.`);
      } else if (accepted.length >= room) {
        problems.push(`${file.name}: a property can have ${MAX_MEDIA_PER_PROPERTY} photos at most.`);
      } else {
        accepted.push(file);
      }
    }
    setRejected(problems);
    if (accepted.length === 0) return;

    const staged = await Promise.all(
      accepted.map(async (file): Promise<StagedPhoto> => {
        const size = await readDimensions(file);
        return { kind: "new", id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), altText: "", ...size };
      }),
    );
    onChange([...photos, ...staged]);
  }

  const setAltText = (id: string, altText: string) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, altText } : p)));

  const remove = (photo: PhotoItem) => {
    if (photo.kind === "new") URL.revokeObjectURL(photo.previewUrl);
    onChange(photos.filter((p) => p.id !== photo.id));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) void addFiles([...e.dataTransfer.files]);
  };

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          "hover:border-primary/50 hover:bg-plum-50/40 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
          dragging && "border-primary bg-plum-50/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span aria-hidden className="grid size-11 place-items-center rounded-full bg-plum-100 text-plum-800">
          <ImagePlus className="size-5" />
        </span>
        <span className="font-medium">
          {photos.length === 0 ? "Add photos" : "Add more photos"}
          <span className="font-normal text-muted-foreground"> or drop them here</span>
        </span>
        <span className="text-sm text-muted-foreground">
          JPEG, PNG, WebP or AVIF, up to {MAX_MB} MB each. Landscape photos look best.
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = ""; // allow picking the same file again after removing it
          }}
        />
      </label>

      {rejected.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {rejected.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => {
              const isCover = index === 0;
              return (
                <li key={photo.id} className="flex flex-col gap-2">
                  <div
                    className={cn(
                      "group/photo relative aspect-4/3 overflow-hidden rounded-xl bg-muted",
                      isCover && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                    )}
                  >
                    {photo.kind === "saved" ? (
                      <Image src={photo.url} alt="" fill sizes="(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, nothing to optimise
                      <img src={photo.previewUrl} alt="" className="size-full object-cover" />
                    )}

                    {isCover && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        <Star aria-hidden className="size-3 fill-current" />
                        Cover
                      </span>
                    )}

                    <Button
                      type="button"
                      size="icon-sm"
                      variant="secondary"
                      onClick={() => remove(photo)}
                      disabled={disabled}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute top-2 right-2 rounded-full bg-background/90 shadow-sm backdrop-blur"
                    >
                      <X />
                    </Button>

                    <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="secondary"
                        onClick={() => move(index, index - 1)}
                        disabled={disabled || index === 0}
                        aria-label={`Move photo ${index + 1} earlier`}
                        className="rounded-full bg-background/90 shadow-sm backdrop-blur"
                      >
                        <ArrowLeft />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="secondary"
                        onClick={() => move(index, index + 1)}
                        disabled={disabled || index === photos.length - 1}
                        aria-label={`Move photo ${index + 1} later`}
                        className="rounded-full bg-background/90 shadow-sm backdrop-blur"
                      >
                        <ArrowRight />
                      </Button>
                      {!isCover && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => move(index, 0)}
                          disabled={disabled}
                          className="ml-auto rounded-full bg-background/90 shadow-sm backdrop-blur"
                        >
                          Make cover
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    value={photo.altText}
                    onChange={(e) => setAltText(photo.id, e.target.value)}
                    disabled={disabled}
                    maxLength={200}
                    placeholder="Describe the photo, e.g. Living room"
                    aria-label={`Description of photo ${index + 1}`}
                  />
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {photos.length} of {MAX_MEDIA_PER_PROPERTY} photos. The first one is the cover; use the arrows to reorder.
          </p>
        </>
      )}
    </div>
  );
}

async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return {}; // e.g. AVIF in an older browser: dimensions are optional
  }
}
