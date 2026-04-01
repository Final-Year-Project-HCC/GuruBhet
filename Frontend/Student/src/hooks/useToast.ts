import { useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export function useToast() {
  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 3000) => {
      // This is a placeholder implementation
      // In a real app, you would use a toast library like react-toastify or your custom toast provider
      console.log(`[Toast ${type}]: ${message}`);

      // Example with console for now - integrate with your actual toast library
      if (typeof window !== "undefined") {
        // You can add actual toast notifications here
      }
    },
    [],
  );

  return {
    showToast,
  };
}
