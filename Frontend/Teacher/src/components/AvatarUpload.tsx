/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
} from "react";
import Image from "next/image";
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import LoadingSpinner from "./LoadingSpinner";
import { useUser } from "@/hooks";

// ─── Helpers ────────────────────────────────────────────────────────────────

function centerAspectCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, 1, width, height),
    width,
    height,
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputSize = 400,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      "image/jpeg",
      0.92,
    );
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileInformationProps {
  onSuccess?: () => void;
}

// ─── Sub-component: CropModal ─────────────────────────────────────────────

interface CropModalProps {
  src: string;
  onConfirm: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setImgEl(e.currentTarget); // ← capture the element into state
    setCrop(centerAspectCrop(width, height));
  };

  const handleConfirm = async () => {
    if (!imgEl || !completedCrop) return;
    try {
      const blob = await getCroppedBlob(imgEl, completedCrop);
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(blob, previewUrl);
    } catch {
      toast.error("Failed to crop image");
    }
  };

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: "var(--color-background-primary, #fff)",
          borderRadius: 16,
          padding: "1.5rem",
          width: "100%",
          maxWidth: 520,
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                color: "var(--color-text-primary, #111)",
              }}
            >
              Adjust your photo
            </h3>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 13,
                color: "var(--color-text-secondary, #666)",
              }}
            >
              Drag to reposition · scroll to zoom
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              color: "var(--color-text-secondary, #888)",
              lineHeight: 1,
            }}
            aria-label="Cancel"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Crop area */}
        <div
          style={{
            maxHeight: 380,
            overflow: "hidden",
            borderRadius: 10,
            background: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: 380, maxWidth: "100%", display: "block" }}
            />
          </ReactCrop>
        </div>

        {/* Preview pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-tertiary, #aaa)",
              flexShrink: 0,
            }}
          >
            Preview
          </span>
          {completedCrop && imgEl && (
            <CropPreviewCircle img={imgEl} crop={completedCrop} />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "1px solid var(--color-border-secondary, #ddd)",
              background: "transparent",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              color: "var(--color-text-primary, #111)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!completedCrop}
            style={{
              padding: "9px 24px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: completedCrop ? "pointer" : "not-allowed",
              opacity: completedCrop ? 1 : 0.45,
              letterSpacing: "0.01em",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function CropPreviewCircle({
  img,
  crop,
}: {
  img: HTMLImageElement;
  crop: PixelCrop;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crop.width || !crop.height) return;
    const ctx = canvas.getContext("2d")!;
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      size,
      size,
    );
  }, [crop, img]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "2px solid var(--color-border-secondary, #ddd)",
      }}
    />
  );
}

export function AvatarUpload({ onSuccess }: ProfileInformationProps) {
  const { data: user } = useUser();

  // The final confirmed preview shown in the ring
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // The raw src fed into the crop modal
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync existing avatar from user data
  useEffect(() => {
    if (user?.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    }
  }, [user]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:"))
        URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileSelected = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(e.target.files?.[0]);
    // Reset so same file can be re-chosen
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelected(file);
  };

  const handleCropConfirm = useCallback(
    async (blob: Blob, previewUrl: string) => {
      setCropSrc(null);
      if (avatarPreview?.startsWith("blob:"))
        URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(previewUrl);
      setUploading(true);

      const formData = new FormData();
      formData.append("avatar", blob, "avatar.jpg");
      try {
        await apiClient.post("/users/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Avatar updated");
        onSuccess?.();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to upload avatar",
        );
        setAvatarPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [avatarPreview, onSuccess],
  );

  const handleCropCancel = () => setCropSrc(null);

  const handleRemove = () => {
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
  };

  // Visual state
  const isActive = isDragging || isHovering;

  return (
    <>
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={uploading}
      />

      {/* Crop modal */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* Avatar zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!uploading ? openFilePicker : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "1.25rem 2rem",
          borderRadius: 12,
          border: isDragging ? "2px dashed #378ADD" : "2px dashed transparent",
          background: isDragging ? "#E6F1FB" : "transparent",
          transition: "border-color 0.15s, background 0.15s",
          cursor: uploading ? "default" : "pointer",
        }}
      >
        {/* The ring */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload profile photo"
          onKeyDown={(e) => e.key === "Enter" && !uploading && openFilePicker()}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            position: "relative",
            width: 96,
            height: 96,
            borderRadius: "50%",
            cursor: uploading ? "default" : "pointer",
            outline: "none",
            flexShrink: 0,
            // Dashed ring when empty, solid when has photo
            border: avatarPreview
              ? "2.5px solid var(--color-border-secondary, #ddd)"
              : `2px dashed ${isDragging ? "#378ADD" : "var(--color-border-secondary, #ccc)"}`,
            background: avatarPreview
              ? "transparent"
              : isDragging
                ? "#E6F1FB"
                : "var(--color-background-secondary, #f5f5f5)",
            transition: "border-color 0.15s, background 0.15s, transform 0.15s",
            transform: isDragging ? "scale(1.06)" : "scale(1)",
          }}
        >
          {/* Existing / confirmed avatar */}
          {avatarPreview && (
            <Image
              src={avatarPreview}
              alt="Profile"
              width={96}
              height={96}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}

          {/* Empty state icon */}
          {!avatarPreview && !uploading && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                transition: "opacity 0.15s",
                opacity: isDragging ? 0.4 : 1,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-tertiary, #aaa)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--color-text-tertiary, #aaa)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Upload
              </span>
            </div>
          )}

          {/* Drag overlay */}
          {isDragging && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(55,138,221,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#378ADD"
                strokeWidth="2"
              >
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
                <path d="M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4" />
              </svg>
            </div>
          )}

          {/* Hover overlay (when avatar exists) */}
          {avatarPreview && isActive && !uploading && !isDragging && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  color: "#fff",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Change
              </span>
            </div>
          )}

          {/* Uploading spinner overlay */}
          {uploading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LoadingSpinner />
            </div>
          )}
        </div>

        {/* Hint text */}
        <div style={{ textAlign: "center", lineHeight: 1.5 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--color-text-secondary, #666)",
            }}
          >
            Click or drag & drop
          </p>
          <p
            style={{
              margin: "1px 0 0",
              fontSize: 11,
              color: "var(--color-text-tertiary, #aaa)",
            }}
          >
            PNG, JPG, WEBP · max 10 MB
          </p>
        </div>

        {/* Remove button */}
        {avatarPreview && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 12px",
              borderRadius: 99,
              border: "1px solid var(--color-border-secondary, #ddd)",
              background: "transparent",
              fontSize: 12,
              color: "var(--color-text-secondary, #888)",
              cursor: "pointer",
              transition: "color 0.12s, border-color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#dc2626";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "#dc2626";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-text-secondary, #888)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--color-border-secondary, #ddd)";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Remove photo
          </button>
        )}
      </div>
    </>
  );
}
