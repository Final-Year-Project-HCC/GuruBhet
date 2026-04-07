"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "./api";
import {
  University,
  Faculty,
  Subject,
  CreateUniversityRequest,
  CreateFacultyRequest,
  CreateSubjectRequest,
  BulkCreateFacultyRequest,
  BulkCreateSubjectRequest,
} from "./types";
import { toast } from "react-toastify";

/**
 * Universities
 */
export function useFetchUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await apiClient.get<University[]>("/academic/universities");
      return data;
    },
  });
}

export function useCreateUniversity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUniversityRequest) => {
      const { data } = await apiClient.post<University>(
        "/academic/universities",
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      toast.success("University created successfully!");
    },
    onError: () => {
      toast.error("Failed to create university");
    },
  });
}

/**
 * Faculties
 */
export function useFetchFacultiesByUniversity(universityId: string | null) {
  return useQuery({
    queryKey: ["faculties", universityId],
    queryFn: async () => {
      if (!universityId) return [];
      const { data } = await apiClient.get<Faculty[]>(
        `/academic/universities/${universityId}/faculties`
      );
      return data;
    },
    enabled: !!universityId,
  });
}

export function useCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFacultyRequest) => {
      const { data } = await apiClient.post<Faculty>(
        `/academic/universities/${payload.universityId}/faculties`,
        payload
      );
      return { faculty: data, universityId: payload.universityId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["faculties", result.universityId],
      });
      toast.success("Faculty created successfully!");
    },
    onError: () => {
      toast.error("Failed to create faculty");
    },
  });
}

export function useBulkCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkCreateFacultyRequest) => {
      const { data } = await apiClient.post<Faculty[]>(
        "/academic/faculties/bulk",
        payload
      );
      return { faculties: data, universityIds: payload.faculties.map(f => f.universityId) };
    },
    onSuccess: (result) => {
      if (result.universityIds.length > 0) {
        // Invalidate queries for all affected universities
        result.universityIds.forEach(universityId => {
          queryClient.invalidateQueries({
            queryKey: ["faculties", universityId],
          });
        });
      }
      toast.success(`${result.faculties.length} faculties created successfully!`);
    },
    onError: () => {
      toast.error("Failed to create faculties");
    },
  });
}


/**
 * Subjects
 */
export function useFetchSubjectsByFaculty(
  universityId: string | null,
  facultyId: string | null
) {
  return useQuery({
    queryKey: ["subjects", universityId, facultyId],
    queryFn: async () => {
      if (!universityId || !facultyId) return [];
      const { data } = await apiClient.get<Subject[]>(
        `/subjects/universities/${universityId}/faculties/${facultyId}/subjects`
      );
      return data;
    },
    enabled: !!universityId && !!facultyId,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSubjectRequest) => {
      const { data } = await apiClient.post<Subject>(
        "/subjects",
        payload
      );
      return { subject: data, universityId: payload.universityId, facultyId: payload.facultyId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["subjects", result.universityId, result.facultyId],
      });
      toast.success("Subject created successfully!");
    },
    onError: () => {
      toast.error("Failed to create subject");
    },
  });
}

export function useBulkCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkCreateSubjectRequest) => {
      const { data } = await apiClient.post<Subject[]>(
        "/subjects/bulk",
        payload
      );
      return { 
        subjects: data, 
        universityIds: [...new Set(payload.subjects.map(s => s.universityId))],
        facultyIds: [...new Set(payload.subjects.map(s => s.facultyId))]
      };
    },
    onSuccess: (result) => {
      if (result.universityIds.length > 0) {
        // Invalidate queries for all affected universities and faculties
        result.universityIds.forEach(universityId => {
          result.facultyIds.forEach(facultyId => {
            queryClient.invalidateQueries({
              queryKey: ["subjects", universityId, facultyId],
            });
          });
        });
      }
      toast.success(`${result.subjects.length} subjects created successfully!`);
    },
    onError: () => {
      toast.error("Failed to create subjects");
    },
  });
}
