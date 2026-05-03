import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api';
import {
  TeacherPublicProfile,
  TeacherSubjectRead,
  TeacherRating,
  TeacherSubject,
  CreateBookingRequest,
} from '@/lib/types';

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch a teacher's public profile (bio, tagline, name, avatar).
 * GET /teachers/{teacherId}/profile
 */
export const useTeacherPublicProfile = (teacherId: string | null) => {
  return useQuery({
    queryKey: ['teacherProfile', teacherId],
    queryFn: async () => {
      const { data } = await apiClient.get<TeacherPublicProfile>(
        `/teachers/${teacherId}/profile`
      );
      return data;
    },
    enabled: !!teacherId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Fetch a teacher's active subject registrations with rates and experience.
 * GET /teachers/{teacherId}/subjects
 */
export const useTeacherPublicSubjects = (teacherId: string | null) => {
  return useQuery({
    queryKey: ['teacherSubjects', teacherId],
    queryFn: async () => {
      const { data } = await apiClient.get<TeacherSubjectRead[]>(
        `/teachers/${teacherId}/subjects`
      );
      return data;
    },
    enabled: !!teacherId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Fetch the latest 3 ratings for a teacher.
 * GET /teachers/{teacherId}/ratings
 */
export const useTeacherRatings = (teacherId: string | null) => {
  return useQuery({
    queryKey: ['teacherRatings', teacherId],
    queryFn: async () => {
      const { data } = await apiClient.get<TeacherRating[]>(
        `/teachers/${teacherId}/ratings`
      );
      return data;
    },
    enabled: !!teacherId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Create a booking request (student → teacher).
 * POST /bookings/request
 */
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBookingRequest) => {
      const { data } = await apiClient.post('/bookings/request', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Converts a TeacherSubjectRead (API response shape) into a TeacherSubject
 * (local UI model used by SubjectCard and BookingModal).
 */
export function adaptToTeacherSubject(ts: TeacherSubjectRead): TeacherSubject {
  return {
    teacherId: ts.teacherId,
    ratePerSession: ts.ratePerSession,
    yearsOfExperience: ts.yearsOfExperience,
    experienceMinutes: ts.experienceMinutes,
    totalSessionsCompleted: ts.totalSessionsCompleted,
    avgRating: ts.avgRating,
    ratingCount: ts.ratingCount,
    isActive: true,
    subject: ts.subject,
  };
}
