"use client";
import Image from "next/image";

import { useEffect } from "react";

type Props = {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ImagePreviewModal({ src, alt, isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-muted bg-opacity-80 backdrop-blur-sm" onClick={onClose}>
      <button
        aria-label="Close image preview"
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-background text-foreground ring-1 ring-border opacity-70 hover:opacity-90 flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <Image
        src={src}
        alt={alt || "Image preview"}
        width={1600}
        height={1200}
        unoptimized
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
