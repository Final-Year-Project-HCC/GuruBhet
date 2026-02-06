"use client";

import { useEffect, useRef } from "react";
import React from "react";

type ModalProps = {
  isOpen: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function Modal({
  isOpen,
  title,
  children,
  description,
  onClose,
  actions,
  closeOnBackdrop = true,
  closeOnEsc = true,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEsc) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeOnEsc, onClose]);

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialogRef.current?.focus();
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses =
    size === "sm"
      ? "max-w-sm"
      : size === "lg"
      ? "max-w-2xl"
      : "max-w-lg";

  const onBackdropClick = () => {
    if (closeOnBackdrop) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      aria-hidden={!isOpen}
      aria-label="Modal backdrop"
      onClick={onBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        ref={dialogRef}
        className={`w-full ${sizeClasses} rounded-md bg-background p-4 border border-border shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 id="modal-title" className="text-base font-semibold">
            {title}
          </h3>
        )}
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : (
          children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>
        )}
        {actions && <div className="mt-4 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
