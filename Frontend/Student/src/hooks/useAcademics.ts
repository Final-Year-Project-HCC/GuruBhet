import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api';
import { StudyLevel, Board, Faculty, Subject, TeacherSearchResult } from '@/lib/types';

export interface TeacherSearchFilters {
  minRating?: number;
  minRate?: number;
  maxRate?: number;
}

/**
 * Fetch all study levels
 */
export const useStudyLevels = () => {
  return useQuery({
    queryKey: ['studyLevels'],
    queryFn: async () => {
      const { data } = await apiClient.get<StudyLevel[]>('/academics/study-levels/');
      return data;
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
      const { data } = await apiClient.get<Board[]>('/academics/boards/', {
        params: studyLevelId ? { studyLevelId } : {},
      });
      return data;
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
      const { data } = await apiClient.get<Faculty[]>('/academics/faculties/', {
        params: boardId ? { boardId } : {},
      });
      return data;
    },
    enabled: !!boardId,
    staleTime: 1000 * 60 * 30,
  });
};


/**
 * Search subjects with debounce (handles full context)
 * Uses public /subjects endpoint with search parameter
 */
export const useSubjectSearchSuggestions = (query: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['SuggestedSubjects', query],
    queryFn: async () => {
      const { data } = await apiClient.get<Subject[]>('/subjects/suggest', {
        params: { q: query, limit: 10 },
      });

      return data;
    },
    enabled: enabled && query.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (previously cacheTime)
  });
};

/**
 * Fetch all subjects (without search filter)
 */
export const useSubjects = (facultyId: string | null) => {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<Subject[]>('academics/subjects/', {
        params: { facultyId: facultyId },
      });
      return data;
    },
    enabled: !!facultyId,
    staleTime: 1000 * 60 * 30,
  });
};

/**
 * Fetch teachers for a specific subject with optional server-side filters
 */
export const useTeachersBySubject = (
  subjectId: string | null,
  filters?: TeacherSearchFilters
) => {
  const { minRating, minRate, maxRate } = filters ?? {};
  return useQuery({
    queryKey: ['teachersBySubject', subjectId, minRating, minRate, maxRate],
    queryFn: async () => {
      const { data } = await apiClient.get<TeacherSearchResult[]>('/teachers/search/', {
        params: {
          subjectId,
          limit: 50,
          ...(minRating !== undefined && minRating > 0 && { minRating }),
          ...(minRate !== undefined && { minRate }),
          ...(maxRate !== undefined && { maxRate }),
        },
      });
      return data;
    },
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
