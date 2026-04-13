import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { CreateTeacherSubjectRequest, StudyLevel, Board, Faculty, Subject } from '@/lib/types';
import { toast } from 'react-toastify';

/**
 * Fetch all study levels
 */
export const useStudyLevels = () => {
  return useQuery({
    queryKey: ['studyLevels'],
    queryFn: async () => {
      const { data } = await apiClient.get<StudyLevel[]>('/academics/study-levels');
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * Fetch boards for a specific study level
 */
export const useBoards = (studyLevelId: string | null) => {
  return useQuery({
    queryKey: ['boards', studyLevelId],
    queryFn: async () => {
      if (!studyLevelId) return [];
      const { data } = await apiClient.get<Board[]>('/academics/boards', {
        params: { studyLevelId },
      });
      return data || [];
    },
    enabled: !!studyLevelId,
    staleTime: 1000 * 60 * 30,
  });
};

/**
 * Fetch faculties for a specific board
 */
export const useFaculties = (boardId: string | null) => {
  return useQuery({
    queryKey: ['faculties', boardId],
    queryFn: async () => {
      if (!boardId) return [];
      const { data } = await apiClient.get<Faculty[]>('/academics/faculties', {
        params: { boardId },
      });
      return data || [];
    },
    enabled: !!boardId,
    staleTime: 1000 * 60 * 30,
  });
};

/**
 * Fetch subjects for a specific faculty
 */
export const useSubjects = (facultyId: string | null) => {
  return useQuery({
    queryKey: ['subjects', facultyId],
    queryFn: async () => {
      if (!facultyId) return [];
      const { data } = await apiClient.get<Subject[]>('/academics/subjects', {
        params: { facultyId },
      });
      return data || [];
    },
    enabled: !!facultyId,
    staleTime: 1000 * 60 * 30,
  });
};


export const useAddTeacherSubject = (
  teacherId: string | undefined,
  options?: { onSuccess?: () => void },
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTeacherSubjectRequest) => {
      const { data } = await apiClient.post('/teachers/me/subjects', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Subject added successfully');
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId, 'subjects'] });
      options?.onSuccess?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to add subject');
    },
  });
};

/**
 * Mutation to remove a subject from the current teacher's profile.
 * @param teacherId - used for cache invalidation of [`teacher`, teacherId, `subjects`]
 * @param options.onSuccess - optional callback after a successful delete
 */
export const useDeleteTeacherSubject = (
  teacherId: string | undefined,
  options?: { onSuccess?: () => void },
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subjectId: string) => {
      await apiClient.delete(`/teachers/me/subjects/${subjectId}`);
    },
    onSuccess: () => {
      toast.success('Subject removed successfully');
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId, 'subjects'] });
      options?.onSuccess?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete subject');
    },
  });
};
