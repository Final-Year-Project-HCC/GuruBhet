"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { StudyLevel, Board, Faculty, Subject, UnitType } from "../lib/types";
import { toast } from "react-toastify";

// ═══════════════════════════════════════════════════════════════════════════════
// STUDY LEVEL QUERIES & MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFetchStudyLevels() {
  return useQuery({
    queryKey: ["studyLevels"],
    queryFn: async () => {
      const { data } = await apiClient.get<StudyLevel[]>(
        "/academics/study-levels",
      );
      return data;
    },
  });
}

export function useCreateStudyLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      // Only include description if it has a value
      const payload: { name: string; description?: string } = {
        name: input.name.trim(),
      };
      if (input.description?.trim()) {
        payload.description = input.description.trim();
      }

      const { data } = await apiClient.post<StudyLevel>(
        "/academics/study-levels",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyLevels"] });
      toast.success("Study Level created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.detail || "Failed to create study level",
      );
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD QUERIES & MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFetchAllBoards() {
  return useQuery({
    queryKey: ["allBoards"],
    queryFn: async () => {
      const { data } = await apiClient.get<Board[]>("/academics/boards");
      return data;
    },
  });
}

export function useFetchBoardsByStudyLevel(studyLevelId: string | null) {
  return useQuery({
    queryKey: ["boards", studyLevelId],
    queryFn: async () => {
      const { data } = await apiClient.get<Board[]>("/academics/boards", {
        params: { studyLevelId },
      });
      return data;
    },
    enabled: !!studyLevelId,
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      studyLevelIds: string[];
    }) => {
      // Only include description if it has a value
      const payload: {
        name: string;
        description?: string;
        studyLevelIds: string[];
      } = {
        name: input.name.trim(),
        studyLevelIds: input.studyLevelIds,
      };
      if (input.description?.trim()) {
        payload.description = input.description.trim();
      }

      const { data } = await apiClient.post<Board>(
        "/academics/boards",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate boards for all study levels in studyLevelIds if available
      queryClient.invalidateQueries({ queryKey: ["allBoards"] });
      toast.success("Board created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to create board");
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACULTY QUERIES & MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFetchFacultiesByHierarchy(
  studyLevelId: string | null,
  boardId: string | null,
) {
  return useQuery({
    queryKey: ["faculties", studyLevelId, boardId],
    queryFn: async () => {
      const { data } = await apiClient.get<Faculty[]>("/academics/faculties", {
        params: {
          studyLevelId,
          boardId,
        },
      });
      return data;
    },
    enabled: !!studyLevelId && !!boardId,
  });
}

export function useCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      boardId: string;
      studyLevelId: string;
      name: string;
      description?: string;
      unitType: UnitType;
      totalUnits: number;
    }) => {
      // Only include description if it has a value
      const payload: {
        boardId: string;
        studyLevelId: string;
        name: string;
        description?: string;
        unitType: UnitType;
        totalUnits: number;
      } = {
        boardId: input.boardId,
        studyLevelId: input.studyLevelId,
        name: input.name.trim(),
        unitType: input.unitType,
        totalUnits: input.totalUnits,
      };
      if (input.description?.trim()) {
        payload.description = input.description.trim();
      }

      const { data } = await apiClient.post<Faculty>(
        "/academics/faculties",
        payload,
      );
      return data;
    },
    onSuccess: (data, { studyLevelId, boardId }) => {
      queryClient.invalidateQueries({
        queryKey: ["faculties", studyLevelId, boardId],
      });
      toast.success("Faculty created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to create faculty");
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT QUERIES & MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFetchSubjectsByHierarchy(
  facultyId: string | null,
) {
  return useQuery({
    queryKey: ["subjects", facultyId],
    queryFn: async () => {
      const { data } = await apiClient.get<Subject[]>("/academics/subjects", {
        params: {
          facultyId,
        },
      });
      return data;
    },
    enabled: !!facultyId
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      facultyId: string;
      unitValue: number;
    }) => {
      const { data } = await apiClient.post<Subject>(
        "/academics/subjects",
        payload,
      );
      return data;
    },
    onSuccess: (data, { facultyId }) => {
      queryClient.invalidateQueries({
        queryKey: ["subjects", facultyId],
      });
      toast.success("Subject created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to create subject");
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useDeleteStudyLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/academics/study-levels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyLevels"] });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Study Level deleted successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.detail || "Failed to delete study level",
      );
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/academics/boards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allBoards"] });
      queryClient.invalidateQueries({ queryKey: ["faculties"] });
      toast.success("Board deleted successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to delete board");
    },
  });
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/academics/faculties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculties"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Faculty deleted successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to delete faculty");
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/academics/subjects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to delete subject");
    },
  });
}