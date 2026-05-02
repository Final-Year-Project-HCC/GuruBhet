"use client";

import PendingTeacherList from "@/components/PendingTeacherList";
import { PermissionGate } from "@/components/PermissionGate";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { useState } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";

type PendingTeacher = {
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
};

async function fetchPending(page: number): Promise<PendingTeacher[]> {
  const { data } = await apiClient.get("/staff/teachers/pending", { params: { page } });
  return data;
}

export default function TeachersLandingPage() {
  const [page, setPage] = useState(1);
  // Visited pages tracked in state, updated only in event handlers (compiler-safe).
  // Array grows as user navigates forward; navigating back keeps all known buttons.
  const [visitedPages, setVisitedPages] = useState<number[]>([1]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "pending-teachers", page],
    queryFn: () => fetchPending(page),
  });

  const hasMore = data !== undefined && data.length === 10;

  const goToPage = (n: number) => {
    setPage(n);
    setVisitedPages((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)));
  };

  const pageButtons = visitedPages;

  return (
    <PermissionGate
      require="teacher:verify"
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-semibold mb-3">Access Denied</h1>
          <p className="text-muted-foreground">You don&apos;t have permission to view pending teachers.</p>
        </div>
      }
    >
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl font-semibold mb-1">Pending Teacher Submissions</h1>
        <p className="text-muted-foreground mb-6">Review and verify teacher account details.</p>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
            ))}
          </div>
        )}
        {isError && <p className="text-destructive">Failed to load submissions.</p>}
        {data && <PendingTeacherList items={data} routePrefix="/teachers" />}

        {/* Pagination */}
        {!isLoading && !isError && (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {/* Previous */}
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm font-medium transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-accent hover:text-accent-foreground"
              aria-label="Previous page"
            >
              <MdChevronLeft className="h-4 w-4" />
              Prev
            </button>

            {/* Numbered buttons */}
            {pageButtons.map((n) => (
              <button
                key={n}
                onClick={() => goToPage(n)}
                className={`min-w-9 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors
                  ${n === page
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-accent hover:text-accent-foreground"
                  }`}
                aria-label={`Go to page ${n}`}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={!hasMore}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm font-medium transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-accent hover:text-accent-foreground"
              aria-label="Next page"
            >
              Next
              <MdChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
