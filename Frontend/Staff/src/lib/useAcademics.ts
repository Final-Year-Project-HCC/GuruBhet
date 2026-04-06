"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "./api";
import {
  StudyLevel,
  Board,
  Faculty,
  Subject,
  UnitType,
} from "./types";
import { toast } from "react-toastify";

// ═══════════════════════════════════════════════════════════════════════════════
// STUDY LEVEL QUERIES & MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFetchStudyLevels() {
  return useQuery({
    queryKey: ["studyLevels"],
    queryFn: async () => {
      const { data } = await apiClient.get<StudyLevel[]>("/academics/study-levels");
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
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyLevels"] });
      toast.success("Study Level created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to create study level");
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD QUERIES & MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFetchBoardsByStudyLevel(studyLevelId: string | null) {
  return useQuery({
    queryKey: ["boards", studyLevelId],
    queryFn: async () => {
      if (!studyLevelId) return [];
      const { data } = await apiClient.get<Board[]>("/academics/boards", {
        params: { study_level_id: studyLevelId },
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
      study_level_ids: string[];
    }) => {
      // Only include description if it has a value
      const payload: {
        name: string;
        description?: string;
        study_level_ids: string[];
      } = {
        name: input.name.trim(),
        study_level_ids: input.study_level_ids,
      };
      if (input.description?.trim()) {
        payload.description = input.description.trim();
      }
      
      const { data } = await apiClient.post<Board>(
        "/academics/boards",
        payload
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate boards for all study levels in study_level_ids if available
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
  boardId: string | null
) {
  return useQuery({
    queryKey: ["faculties", studyLevelId, boardId],
    queryFn: async () => {
      if (!studyLevelId || !boardId) return [];
      const { data } = await apiClient.get<Faculty[]>("/academics/faculties", {
        params: {
          study_level_id: studyLevelId,
          board_id: boardId,
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
      board_id: string;
      study_level_id: string;
      name: string;
      description?: string;
      unit_type: UnitType;
      total_units: number;
    }) => {
      // Only include description if it has a value
      const payload: {
        board_id: string;
        study_level_id: string;
        name: string;
        description?: string;
        unit_type: UnitType;
        total_units: number;
      } = {
        board_id: input.board_id,
        study_level_id: input.study_level_id,
        name: input.name.trim(),
        unit_type: input.unit_type,
        total_units: input.total_units,
      };
      if (input.description?.trim()) {
        payload.description = input.description.trim();
      }
      
      const { data } = await apiClient.post<Faculty>(
        "/academics/faculties",
        payload
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["faculties", data.study_level_id, data.board_id],
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
  studyLevelId: string | null,
  boardId: string | null,
  facultyId: string | null
) {
  return useQuery({
    queryKey: ["subjects", studyLevelId, boardId, facultyId],
    queryFn: async () => {
      if (!studyLevelId || !boardId || !facultyId) return [];
      const { data } = await apiClient.get<Subject[]>("/academics/subjects", {
        params: {
          study_level_id: studyLevelId,
          board_id: boardId,
          faculty_id: facultyId,
        },
      });
      return data;
    },
    enabled: !!studyLevelId && !!boardId && !!facultyId,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      study_level_id: string;
      board_id: string;
      faculty_id: string;
      unit_value: number;
    }) => {
      const { data } = await apiClient.post<Subject>(
        "/academics/subjects",
        payload
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["subjects", data.study_level_id, data.board_id, data.faculty_id],
      });
      toast.success("Subject created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || "Failed to create subject");
    },
  });
}
