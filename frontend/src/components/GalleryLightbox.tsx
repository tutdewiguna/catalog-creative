"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { GalleryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type GalleryLightboxProps = {
  item: GalleryItem;
  currentIndex: number;
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onSelect: (index: number) => void;
};

const overlayButtonClasses =
  "inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 p-3 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export default function GalleryLightbox({
  item,
  currentIndex,
  onClose,
  onNavigate,
  onSelect,
}: GalleryLightboxProps) {
  const assets = item.assets ?? [];
  const asset = assets[currentIndex];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        onNavigate("prev");
      } else if (event.key === "ArrowRight") {
        onNavigate("next");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, onNavigate]);

  if (!asset) {
    return null;
  }

  const isPDF = asset.type === "pdf";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-5 py-8 text-white">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C9A46A]">
              {item.section}
            </p>
            <h2 className="text-2xl font-semibold">{item.title}</h2>
            {item.subtitle && (
              <p className="mt-1 text-sm text-white/80">{item.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={overlayButtonClasses}
            aria-label="Close gallery preview"
          >
            <X size={22} aria-hidden />
          </button>
        </header>

        <div className="relative flex flex-1 items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-4">
          {isPDF ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center text-white/80">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <FileText size={36} />
              </div>
              <p className="max-w-sm text-sm leading-relaxed">
                This gallery entry is provided as a PDF document. Open the file
                below to view the full presentation.
              </p>
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/50 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Open PDF
              </a>
            </div>
          ) : (
            <div className="relative w-full overflow-hidden rounded-[2rem] bg-black/30 shadow-2xl">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl">
                <Image
                  src={asset.url}
                  alt={asset.caption || item.title}
                  fill
                  className="object-contain"
                  sizes="(min-width: 1024px) 75vw, 100vw"
                  priority
                />
              </div>
              {asset.caption && (
                <p className="mt-4 text-center text-xs uppercase tracking-[0.3em] text-white/60">
                  {asset.caption}
                </p>
              )}
            </div>
          )}

          {assets.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onNavigate("prev")}
                className={cn(
                  overlayButtonClasses,
                  "absolute left-4 top-1/2 -translate-y-1/2"
                )}
                aria-label="Previous image"
              >
                <ChevronLeft size={22} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("next")}
                className={cn(
                  overlayButtonClasses,
                  "absolute right-4 top-1/2 -translate-y-1/2"
                )}
                aria-label="Next image"
              >
                <ChevronRight size={22} aria-hidden />
              </button>
            </>
          )}
        </div>

        {assets.length > 1 && !isPDF && (
          <div className="flex flex-wrap justify-center gap-3">
            {assets.map((preview, index) => (
              <button
                key={`${preview.url}-${index}`}
                type="button"
                onClick={() => {
                  if (index !== currentIndex) {
                    onSelect(index);
                  }
                }}
                className={cn(
                  "relative h-16 w-20 overflow-hidden rounded-xl border transition",
                  index === currentIndex
                    ? "border-white shadow-lg"
                    : "border-white/20 opacity-70 hover:opacity-100"
                )}
                aria-label={`Preview ${index + 1}`}
              >
                <Image
                  src={preview.url}
                  alt={preview.caption || `Preview ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
