"use client";

import { useRouter } from "next/navigation";
import SearchPage from "@/components/SearchTeacher/SearchPage";

export default function Page() {
  const router = useRouter();

  const handleViewProfile = (id: string) => {
    router.push(`/teacher-detail/${id}`);
  };

  return <SearchPage onViewProfile={handleViewProfile} />;
}
