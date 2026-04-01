"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { buildUrl } from "./utils";
import {
  University,
  Faculty,
  Semester,
  Subject,
  CreateUniversityRequest,
  CreateFacultyRequest,
  CreateSemesterRequest,
  CreateSubjectRequest,
  BulkCreateSubjectRequest,
  BulkCreateFacultyRequest,
} from "./types";
import { toast } from "react-toastify";

/**
 * Universities
 */
export function useFetchUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await axios.get<University[]>(buildUrl("/staff/universities"));
      return data;
    },
  });
}

export function useCreateUniversity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUniversityRequest) => {
      const { data } = await axios.post<University>(
        buildUrl("/staff/universities"),
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
      const { data } = await axios.get<Faculty[]>(
        buildUrl(`/staff/universities/${universityId}/faculties`)
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
      const { data } = await axios.post<Faculty>(
        buildUrl(`/staff/universities/${payload.universityId}/faculties`),
        {
          name: payload.name,
          description: payload.description,
          numberOfSemesters: payload.numberOfSemesters,
        }
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
      const { data } = await axios.post<Faculty[]>(
        buildUrl("/staff/faculties/bulk"),
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
 * Semesters
 */
export function useFetchSemestersByFaculty(
  universityId: string | null,
  facultyId: string | null
) {
  return useQuery({
    queryKey: ["semesters", universityId, facultyId],
    queryFn: async () => {
      if (!universityId || !facultyId) return [];
      const { data } = await axios.get<Semester[]>(
        buildUrl(
          `/staff/universities/${universityId}/faculties/${facultyId}/semesters`
        )
      );
      return data;
    },
    enabled: !!universityId && !!facultyId,
  });
}

export function useCreateSemester() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSemesterRequest) => {
      const { data } = await axios.post<Semester>(
        buildUrl(
          `/staff/universities/${payload.universityId}/faculties/${payload.facultyId}/semesters`
        ),
        {
          semesterNumber: payload.semesterNumber,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["semesters", data.universityId, data.facultyId],
      });
      toast.success("Semester created successfully!");
    },
    onError: () => {
      toast.error("Failed to create semester");
    },
  });
}

/**
 * Subjects
 */
export function useFetchSubjectsByFaculty(
  universityId: string | null,
  facultyId: string | null,
  semesterId: string | null
) {
  return useQuery({
    queryKey: ["subjects", universityId, facultyId, semesterId],
    queryFn: async () => {
      if (!universityId || !facultyId || !semesterId) return [];
      const { data } = await axios.get<Subject[]>(
        buildUrl(
          `/staff/universities/${universityId}/faculties/${facultyId}/semesters/${semesterId}/subjects`
        )
      );
      return data;
    },
    enabled: !!universityId && !!facultyId && !!semesterId,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSubjectRequest) => {
      const { data } = await axios.post<Subject>(
        buildUrl(
          `/staff/universities/${payload.universityId}/faculties/${payload.facultyId}/semesters/${payload.semesterId}/subjects`
        ),
        {
          name: payload.name,
          description: payload.description,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["subjects", data.universityId, data.facultyId, data.semesterId],
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
      const { data } = await axios.post<Subject[]>(
        buildUrl("/staff/subjects/bulk"),
        payload
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        const item = data[0];
        queryClient.invalidateQueries({
          queryKey: ["subjects", item.universityId, item.facultyId, item.semesterId],
        });
      }
      toast.success(`${data.length} subjects created successfully!`);
    },
    onError: () => {
      toast.error("Failed to create subjects");
    },
  });
}
