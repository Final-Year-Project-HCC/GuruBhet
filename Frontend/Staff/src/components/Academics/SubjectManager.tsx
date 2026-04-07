"use client";

import { useState } from "react";
import { useFetchStudyLevels, useFetchBoardsByStudyLevel } from "@/lib/useAcademics";
import { useFetchFacultiesByHierarchy, useFetchSubjectsByHierarchy, useCreateSubject } from "@/lib/useAcademics";
import { Subject, StudyLevel, Board, Faculty } from "@/lib/types";
import { FiAlertCircle } from "react-icons/fi";

export default function SubjectManager() {
  const [showForm, setShowForm] = useState(false);
  const [selectedStudyLevelId, setSelectedStudyLevelId] = useState<string>("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [unitValue, setUnitValue] = useState("1");

  const { data: levels, isLoading: levelsLoading } = useFetchStudyLevels();
  const { data: boards, isLoading: boardsLoading } = useFetchBoardsByStudyLevel(
    selectedStudyLevelId
  );
  const { data: faculties, isLoading: facultiesLoading } = useFetchFacultiesByHierarchy(
    selectedStudyLevelId || null,
    selectedBoardId || null
  );
  const { data: subjects, isLoading: subjectsLoading, isError: subjectsError } =
    useFetchSubjectsByHierarchy(
      selectedStudyLevelId || null,
      selectedBoardId || null,
      selectedFacultyId || null
    );

  const createMutation = useCreateSubject();

  const handleAddSubject = () => {
    if (
      newName.trim() &&
      selectedStudyLevelId &&
      selectedBoardId &&
      selectedFacultyId &&
      unitValue &&
      parseInt(unitValue) >= 1
    ) {
      createMutation.mutate({
        name: newName,
        study_level_id: selectedStudyLevelId,
        board_id: selectedBoardId,
        faculty_id: selectedFacultyId,
        unit_value: parseInt(unitValue),
      });
      setNewName("");
      setUnitValue("1");
    }
  };

  const selectedFaculty = faculties?.find((f) => f.id === selectedFacultyId);
  const maxUnits = selectedFaculty?.total_units || 1;

  const isLoading = levelsLoading || boardsLoading || facultiesLoading || subjectsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Subjects</h2>
        <p className="text-muted-foreground mt-1">
          Create subjects by selecting a study level, board, and faculty. Then specify the unit value (grade/semester/year number).
        </p>
      </div>

      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Step 1: Select Hierarchy</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Study Level *
            </label>
            <select
              value={selectedStudyLevelId}
              onChange={(e) => {
                setSelectedStudyLevelId(e.target.value);
                setSelectedBoardId("");
                setSelectedFacultyId("");
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a study level...</option>
              {levels?.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Board *
            </label>
            <select
              value={selectedBoardId}
              onChange={(e) => {
                setSelectedBoardId(e.target.value);
                setSelectedFacultyId("");
              }}
              disabled={!selectedStudyLevelId || !boards || boards.length === 0}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a board...</option>
              {boards?.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Faculty *
            </label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              disabled={!selectedBoardId || !faculties || faculties.length === 0}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a faculty...</option>
              {faculties?.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Add Subject Form */}
      {selectedStudyLevelId && selectedBoardId && selectedFacultyId && selectedFaculty && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              + Add Subject
            </button>
          ) : (
            <div className="border border-border rounded-lg p-4 bg-card space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Step 2: Create New Subject</h3>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Faculty:</strong> {selectedFaculty.name}
                </p>
                <p>
                  <strong>Unit Type:</strong> {selectedFaculty.unit_type} (1 to {maxUnits})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Mathematics, Chemistry, Data Structures"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Unit Value (1 to {maxUnits}) *
                </label>
                <input
                  type="number"
                  value={unitValue}
                  onChange={(e) => setUnitValue(e.target.value)}
                  min="1"
                  max={maxUnits}
                  placeholder={`e.g., 5 (for semester 5 or year 5, etc.)`}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The {selectedFaculty.unit_type.toLowerCase()} number for this subject
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddSubject}
                  disabled={
                    createMutation.isPending ||
                    !newName.trim() ||
                    !unitValue ||
                    parseInt(unitValue) < 1 ||
                    parseInt(unitValue) > maxUnits
                  }
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setNewName("");
                    setUnitValue("1");
                  }}
                  className="px-4 py-2 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">
              {subjects?.length || 0} Subject{(subjects?.length || 0) !== 1 ? "s" : ""}
            </h3>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading subjects...</div>
              </div>
            )}

            {subjectsError && (
              <div className="p-4 bg-destructive/15 border border-destructive rounded-lg flex items-center gap-3">
                <FiAlertCircle className="text-destructive" size={20} />
                <span className="text-destructive">Failed to load subjects</span>
              </div>
            )}

            {!isLoading && !subjectsError && subjects && subjects.length === 0 && (
              <div className="p-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">
                  No subjects yet in {selectedFaculty.name}
                </p>
              </div>
            )}

            {!isLoading && subjects && subjects.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subjects.map((subject) => (
                  <SubjectCard key={subject.id} subject={subject} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedStudyLevelId && selectedBoardId && selectedFacultyId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            💡 <strong>Complete!</strong> Subjects are the final level in the hierarchy. Teachers can now select these subjects to offer.
          </p>
        </div>
      )}
    </div>
  );
}

function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-primary transition-colors">
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">{subject.name}</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          {subject.faculty && (
            <p>
              <strong>Faculty:</strong> {subject.faculty.name}
            </p>
          )}
          <p>
            <strong>Unit Value:</strong> {subject.unit_value}
          </p>
        </div>
        {!subject.is_active && (
          <p className="text-xs text-destructive">Inactive</p>
        )}
      </div>
    </div>
  );
}
