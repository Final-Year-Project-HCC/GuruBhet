"use client";

import { PropsWithChildren, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import { setAuthQueryClient } from "@/lib/api";

export default function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          gcTime: 1000 * 60 * 60, // 1 hour
          retry: 1,
        },
      },
    });
    // Make query client available to auth interceptor
    setAuthQueryClient(client);
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer position="top-right" autoClose={5000} closeOnClick pauseOnHover />
    </QueryClientProvider>
  );
}
