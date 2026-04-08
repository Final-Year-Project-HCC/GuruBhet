import { useQuery } from '@tanstack/react-query';
import apiClient from '../api';
import { StudyLevel, Board, Faculty, Subject, SubjectWithContext, TeacherSearchResult } from '@/components/types';

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
 * Helper function to construct fullContext from a Subject
 */
const constructFullContext = (subject: Subject): string => {
  const studyLevelName = subject.studyLevel?.name || 'Unknown';
  const boardName = subject.board?.name || 'Unknown';
  const facultyName = subject.faculty?.name || 'Unknown';
  const unitType = subject.faculty?.unitType || 'Unit';
  return `${studyLevelName} > ${boardName} > ${facultyName} > ${unitType} ${subject.unitValue}`;
};

/**
 * Helper function to construct contextDict from a Subject
 */
const constructContextDict = (subject: Subject) => ({
  studyLevel: subject.studyLevel?.name || '',
  board: subject.board?.name || '',
  faculty: subject.faculty?.name || '',
  unitValue: subject.unitValue,
  unitType: subject.faculty?.unitType || '',
  totalUnits: subject.faculty?.totalUnits || 1,
});

/**
 * Search subjects with debounce (handles full context)
 * Uses public /subjects endpoint with search parameter
 */
export const useSubjectSearchSuggestions = (query: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['subjectSuggestions', query],
    queryFn: async () => {
      const { data } = await apiClient.get<Subject[]>('/subjects/', {
        params: { search: query, limit: 10 },
      });
      
      // Transform to SubjectWithContext by computing fullContext
      return data.map((subject) => ({
        ...subject,
        fullContext: constructFullContext(subject),
        contextDict: constructContextDict(subject),
      })) as SubjectWithContext[];
    },
    enabled: enabled && query.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (previously cacheTime)
  });
};

/**
 * Fetch all subjects (without search filter)
 */
export const useSubjects = () => {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<Subject[]>('/subjects/', {
        params: { limit: 500 },
      });
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
};

/**
 * Fetch teachers for a specific subject
 */
export const useTeachersBySubject = (subjectId: string | null) => {
  return useQuery({
    queryKey: ['teachersBySubject', subjectId],
    queryFn: async () => {
      const { data } = await apiClient.get<TeacherSearchResult[]>('/teachers/search/', {
        params: { subjectId, limit: 50 },
      });
      return data;
    },
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
