"use client";

import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  useStudyLevels,
  useBoards,
  useFaculties,
  useSubjects,
} from "@/lib/hooks/useAcademics";
import type { StudyLevel, Board, Faculty, Subject } from "@/lib/types";
import apiClient from "@/lib/api";
import { useTeacher } from "@/hooks/useTeacherProfile";
import { useUser } from "@/hooks";

interface HierarchicalSubjectFormProps {
  onSuccess?: () => void;
}

/**
 * HierarchicalSubjectForm Component
 * Implements a 4-level cascading form for subject selection:
 * StudyLevel → Board → Faculty → Subject
 *
 * Features:
 * - Dependent select fields that enable as parent selections are made
 * - Loading states for each level
 * - Dynamic unit value selector based on faculty.unitType
 * - Metadata fields: Rate Per Session & Years of Experience
 * - Subject list below form for management
 */
export function HierarchicalSubjectForm({
  onSuccess,
}: HierarchicalSubjectFormProps) {
  const queryClient = useQueryClient();
  const {data:teacherData} = useUser();
  // Form state with camelCase naming
  const [selectedStudyLevelId, setSelectedStudyLevelId] = useState<string>("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedUnitValue, setSelectedUnitValue] = useState<string>("");
  const [ratePerSession, setRatePerSession] = useState<string>("");
  const [yearsOfExperience, setYearsOfExperience] = useState<string>("");

  // Fetch Study Levels (independent query)
  const {
    data: studyLevels = [],
    isLoading: isLoadingStudyLevels,
    error: studyLevelsError,
  } = useStudyLevels();

  // Fetch Boards (depends on studyLevelId)
  const {
    data: boards = [],
    isLoading: isLoadingBoards,
    error: boardsError,
  } = useBoards(selectedStudyLevelId);

  // Fetch Faculties (depends on boardId)
  const {
    data: faculties = [],
    isLoading: isLoadingFaculties,
    error: facultiesError,
  } = useFaculties(selectedBoardId);

  // Fetch Subjects (depends on facultyId)
  const {
    data: subjects = [],
    isLoading: isLoadingSubjects,
    error: subjectsError,
  } = useSubjects(selectedFacultyId);

  // Get the selected faculty to determine unit type
  const selectedFaculty = useMemo(
    () => faculties.find((f: Faculty) => f.id === selectedFacultyId),
    [selectedFacultyId, faculties],
  );

  // Generate unit options based on faculty totalUnits
  const unitOptions = useMemo(() => {
    if (!selectedFaculty) return [];
    const options = [];
    for (let i = 1; i <= selectedFaculty.totalUnits; i++) {
      options.push({
        value: i.toString(),
        label: `${selectedFaculty.unitType === "SEMESTER" ? "Semester" : selectedFaculty.unitType === "YEAR" ? "Year" : "Grade"} ${i}`,
      });
    }
    return options;
  }, [selectedFaculty]);

  // Determine if form is valid for submission
  const isFormValid =
    selectedStudyLevelId &&
    selectedBoardId &&
    selectedFacultyId &&
    selectedSubjectId &&
    selectedUnitValue &&
    ratePerSession &&
    yearsOfExperience;

  // Add subject mutation
  const addSubjectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/teachers/me/subjects", {
        subjectId: selectedSubjectId,
        ratePerSession: parseInt(ratePerSession),
        yearsOfExperience: parseInt(yearsOfExperience),
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Subject added successfully");
      // Reset form
      setSelectedStudyLevelId("");
      setSelectedBoardId("");
      setSelectedFacultyId("");
      setSelectedSubjectId("");
      setSelectedUnitValue("");
      setRatePerSession("");
      setYearsOfExperience("");
      // Refetch teacher subjects
      queryClient.invalidateQueries({ queryKey: ["teacher", teacherData?.id, "subjects"] });
      onSuccess?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to add subject");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      addSubjectMutation.mutate();
    }
  };

  // Reset dependent fields when parent changes
  const handleStudyLevelChange = (value: string) => {
    setSelectedStudyLevelId(value);
    setSelectedBoardId("");
    setSelectedFacultyId("");
    setSelectedSubjectId("");
    setSelectedUnitValue("");
  };

  const handleBoardChange = (value: string) => {
    setSelectedBoardId(value);
    setSelectedFacultyId("");
    setSelectedSubjectId("");
    setSelectedUnitValue("");
  };

  const handleFacultyChange = (value: string) => {
    setSelectedFacultyId(value);
    setSelectedSubjectId("");
    setSelectedUnitValue("");
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">Add Subject</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Study Level */}
          <div>
            <label
              htmlFor="studyLevel"
              className="block text-sm font-medium mb-2"
            >
              Study Level <span className="text-destructive">*</span>
            </label>
            <select
              id="studyLevel"
              value={selectedStudyLevelId}
              onChange={(e) => handleStudyLevelChange(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoadingStudyLevels}
            >
              <option value="">
                {isLoadingStudyLevels ? "Loading..." : "Select a study level"}
              </option>
              {studyLevels.map((level: StudyLevel) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
            {studyLevelsError && (
              <p className="text-destructive text-sm mt-1">
                Failed to load study levels
              </p>
            )}
          </div>

          {/* Board */}
          <div>
            <label htmlFor="board" className="block text-sm font-medium mb-2">
              Board <span className="text-destructive">*</span>
            </label>
            <select
              id="board"
              value={selectedBoardId}
              onChange={(e) => handleBoardChange(e.target.value)}
              disabled={!selectedStudyLevelId || isLoadingBoards}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedStudyLevelId
                  ? "Select a study level first"
                  : isLoadingBoards
                    ? "Loading..."
                    : "Select a board"}
              </option>
              {boards.map((board: Board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
            {boardsError && (
              <p className="text-destructive text-sm mt-1">
                Failed to load boards
              </p>
            )}
          </div>

          {/* Faculty */}
          <div>
            <label htmlFor="faculty" className="block text-sm font-medium mb-2">
              Faculty / Stream <span className="text-destructive">*</span>
            </label>
            <select
              id="faculty"
              value={selectedFacultyId}
              onChange={(e) => handleFacultyChange(e.target.value)}
              disabled={!selectedBoardId || isLoadingFaculties}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedBoardId
                  ? "Select a board first"
                  : isLoadingFaculties
                    ? "Loading..."
                    : "Select a faculty"}
              </option>
              {faculties.map((faculty: Faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
            </select>
            {facultiesError && (
              <p className="text-destructive text-sm mt-1">
                Failed to load faculties
              </p>
            )}
          </div>
          {/* Unit Value Selector (appears after subject selection) */}
          {selectedFacultyId && selectedFaculty && (
            <div>
              <label
                htmlFor="unitValue"
                className="block text-sm font-medium mb-2"
              >
                {selectedFaculty.unitType === "SEMESTER"
                  ? "Semester"
                  : selectedFaculty.unitType === "YEAR"
                    ? "Year"
                    : "Grade"}{" "}
                <span className="text-destructive">*</span>
              </label>
              <select
                id="unitValue"
                value={selectedUnitValue}
                onChange={(e) => setSelectedUnitValue(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">
                  Select{" "}
                  {selectedFaculty.unitType === "SEMESTER"
                    ? "semester"
                    : selectedFaculty.unitType === "YEAR"
                      ? "year"
                      : "grade"}
                </option>
                {unitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium mb-2">
              Subject <span className="text-destructive">*</span>
            </label>
            <select
              id="subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedFacultyId || isLoadingSubjects}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedFacultyId
                  ? "Select a faculty first"
                  : isLoadingSubjects
                    ? "Loading..."
                    : "Select a subject"}
              </option>
              {subjects
                .filter(
                  (subject: Subject) =>
                    subject.unitValue === parseInt(selectedUnitValue) &&
                    subject.faculty.id === selectedFacultyId &&
                    subject.board.id === selectedBoardId &&
                    subject.studyLevel.id === selectedStudyLevelId,
                )
                .map((subject: Subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
            </select>
            {subjectsError && (
              <p className="text-destructive text-sm mt-1">
                Failed to load subjects
              </p>
            )}
          </div>

          {/* Metadata Fields (active after hierarchy is selected) */}
          {selectedSubjectId && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ratePerSession"
                    className="block text-sm font-medium mb-2"
                  >
                    Rate Per Session (NPR){" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="ratePerSession"
                    type="number"
                    value={ratePerSession}
                    onChange={(e) => setRatePerSession(e.target.value)}
                    min="0"
                    step="50"
                    className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="yearsOfExperience"
                    className="block text-sm font-medium mb-2"
                  >
                    Years of Experience{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="yearsOfExperience"
                    type="number"
                    value={yearsOfExperience}
                    onChange={(e) => setYearsOfExperience(e.target.value)}
                    min="0"
                    max="100"
                    step="0.5"
                    className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 5"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div className="pt-6 flex gap-4">
            <button
              type="submit"
              disabled={!isFormValid || addSubjectMutation.isPending}
              className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addSubjectMutation.isPending
                ? "Adding Subject..."
                : "Add Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
