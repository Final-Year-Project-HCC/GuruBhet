"use client";
import Image from "next/image";
type Props = {
  name: string;
  label: string;
  accept?: string;
  previewSrc?: string;
  onChange: (file: File | null) => void;
  boxSizeClass?: string;
  disabled?: boolean;
};

export default function FileInputWithPreview({
  name,
  label,
  accept = "image/*",
  previewSrc,
  onChange,
  boxSizeClass = "",
  disabled = false,
}: Props) {
  const inputId = `file-${name}`;
  return (
    <div className="space-y-2">
      <label className="block text-muted-foreground">{label}</label>
      <div className="flex flex-col items-start gap-4">
        <input
          id={inputId}
          type="file"
          name={name}
          accept={accept}
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <div className={`relative w-full pb-[75%] overflow-hidden rounded-md border border-border bg-muted ${boxSizeClass}`}>
          {previewSrc ? (
            <Image
              src={previewSrc}
              alt={`${label} preview`}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="absolute top-[50%] left-[50%] -translate-[50%] text-xs text-muted-foreground">
              Preview
            </div>
          )}
        </div>
        {!disabled && (
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer select-none items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-foreground"
            >
              <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Choose File
          </label>
        )}
      </div>
    </div>
  );
}
