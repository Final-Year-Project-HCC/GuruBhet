"use client";
import { useParams, useRouter } from "next/navigation";

import TeacherDetailPage from "@/components/SearchTeacher/TeacherDetailPage";



export default function Page() {
    const params = useParams();
    const router = useRouter();
    const handleBack = () => {
       router.push("/search-teacher");
     };

      if (!params?.id) {
    return <p>No teacher ID found</p>;
  }

 const teacherId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  
  return <TeacherDetailPage teacherId={teacherId} onBack={handleBack} />;
}
