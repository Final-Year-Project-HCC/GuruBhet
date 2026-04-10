import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { StudyLevel, Board, Faculty, Subject } from '@/lib/types';

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
