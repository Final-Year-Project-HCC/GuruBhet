"use client";

import PendingTeacherList from "@/components/PendingTeacherList";
import { PermissionGate } from "@/components/PermissionGate";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";

type PendingTeacher = {
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
};

async function fetchPending(): Promise<PendingTeacher[]> {
  const { data } = await apiClient.get("/staff/teachers/pending");
  return data;
}

export default function TeachersLandingPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "pending-teachers"],
    queryFn: fetchPending,
  });

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
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-semibold mb-3">Pending Teacher Submissions</h1>
        <p className="text-muted-foreground mb-6">Review and verify teacher account details.</p>
        {isLoading && <p className="text-muted-foreground">Loading...</p>}
        {isError && <p className="text-destructive">Failed to load submissions.</p>}
        {data && <PendingTeacherList items={data} routePrefix="/teachers" />}
      </div>
    </PermissionGate>
  );
}
