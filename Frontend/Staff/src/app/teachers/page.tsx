"use client";

import PendingTeacherList from "@/components/PendingTeacherList";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { buildUrl } from "@/lib/utils";

type PendingTeacher = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  submittedAt?: string;
};

async function fetchPending(): Promise<PendingTeacher[]> {
  const url = buildUrl("/staff/teachers/pending");
  const { data } = await axios.get(url);
  return data;
}

export default function TeachersLandingPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["staff", "pending-teachers"], queryFn: fetchPending });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-3">Pending Teacher Submissions</h1>
      <p className="text-muted-foreground mb-6">Review and verify teacher account details.</p>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {isError && <p className="text-destructive">Failed to load submissions.</p>}
      {data && <PendingTeacherList items={data} routePrefix="/teachers" />}
    </div>
  );
}
