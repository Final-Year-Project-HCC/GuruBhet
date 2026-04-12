import apiClient from "@/lib/api";
import { TeacherData, TeacherPublicData, TeacherSubject, TeacherRating } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

const TEACHER_QUERY_KEY = ["teacher", "me"];
const PUBLIC_TEACHER_QUERY_KEY = ["teacher", "public"];

export function useTeacher() {
  return useQuery({
    queryKey: TEACHER_QUERY_KEY,
    queryFn: async (): Promise<TeacherData | null> => {
      try {
        const { data } = await apiClient.get<TeacherData>("/teachers/me/profile");
        return data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60, // 1 hour cache retention
    refetchOnWindowFocus: true, // Refetch on window focus for security
    retry: false, // Don't retry on errors
  });
}

//This is to fetch data for public view of teacher's profile
export function useTeacherForPublic(teacherId: string | null) {
  return useQuery({
    queryKey: PUBLIC_TEACHER_QUERY_KEY,
    queryFn: async (): Promise<TeacherPublicData | null> => {
      try {
        const { data } = await apiClient.get<TeacherPublicData>(`/teachers/${teacherId}/profile`);
        return data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60, // 1 hour cache retention
    refetchOnWindowFocus: true, // Refetch on window focus for security
    retry: false, // Don't retry on errors
    enabled: !!teacherId
  });
}

export function useTeacherSubjects(teacherId: string | null) {
  return useQuery({
    queryKey: ["teacher", teacherId, "subjects"],
    queryFn: async () => {
      if (!teacherId) return null;
      try {
        const { data } = await apiClient.get<TeacherSubject[]>(`/teachers/${teacherId}/subjects`);
        return data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
    retry: false,
    enabled: !!teacherId
  });
}

export function useTeacherRatings(teacherId: string | null) {
  return useQuery({
    queryKey: ["teacher", teacherId, "ratings"],
    queryFn: async () => {
      if (!teacherId) return null;
      try {
        const { data } = await apiClient.get<TeacherRating[]>(`/teachers/${teacherId}/ratings`);
        return data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
    retry: false,
    enabled: !!teacherId
  });
}
