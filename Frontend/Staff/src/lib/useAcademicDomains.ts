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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["faculties", data.universityId],
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
      return data;
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        const universityId = data[0].universityId;
        queryClient.invalidateQueries({
          queryKey: ["faculties", universityId],
        });
      }
      toast.success(`${data.length} faculties created successfully!`);
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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["subjects", data.universityId, data.facultyId],
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
      return data;
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        const item = data[0];
        queryClient.invalidateQueries({
          queryKey: ["subjects", item.universityId, item.facultyId],
        });
      }
      toast.success(`${data.length} subjects created successfully!`);
    },
    onError: () => {
      toast.error("Failed to create subjects");
    },
  });
}
