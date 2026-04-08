"use client";

import React from "react";
import { FiX, FiAlertCircle } from "react-icons/fi";

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  isDangerous?: boolean;
  onClose: () => void;
  primaryButtonText?: string;
  primaryButtonLoading?: boolean;
  onPrimaryAction?: () => void;
  secondaryButtonText?: string;
  onSecondaryAction?: () => void;
}

export function Modal({
  isOpen,
  title,
  description,
  children,
  isDangerous = false,
  onClose,
  primaryButtonText = "Confirm",
  primaryButtonLoading = false,
  onPrimaryAction,
  secondaryButtonText = "Cancel",
  onSecondaryAction,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-background border border-border rounded-lg shadow-lg p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {isDangerous && (
                <div className="flex items-center gap-2 mb-2">
                  <FiAlertCircle className="text-red-500" size={20} />
                </div>
              )}
              <h2 className={`text-lg font-semibold ${isDangerous ? "text-red-500" : "text-foreground"}`}>
                {title}
              </h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Content */}
          {children && <div className="text-sm text-foreground">{children}</div>}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            {onSecondaryAction && (
              <button
                onClick={() => {
                  onSecondaryAction();
                  onClose();
                }}
                className="px-4 py-2 rounded-md font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
              >
                {secondaryButtonText}
              </button>
            )}
            {onPrimaryAction && (
              <button
                onClick={() => {
                  onPrimaryAction();
                  if (!primaryButtonLoading) onClose();
                }}
                disabled={primaryButtonLoading}
                className={`px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDangerous
                    ? "bg-red-500 text-destructive-foreground hover:bg-red-500/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {primaryButtonLoading ? "Processing..." : primaryButtonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
