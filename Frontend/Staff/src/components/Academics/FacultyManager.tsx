"use client";

import { useState } from "react";
import { useFetchStudyLevels, useFetchBoardsByStudyLevel } from "@/lib/useAcademics";
import { useFetchFacultiesByHierarchy, useCreateFaculty } from "@/lib/useAcademics";
import { Faculty, UnitType } from "@/lib/types";
import { FiAlertCircle } from "react-icons/fi";

const UNIT_TYPES: { value: UnitType; label: string; description: string }[] = [
  { value: "GRADE", label: "Grade", description: "For school education (Grade 1-12)" },
  { value: "SEMESTER", label: "Semester", description: "For university programs (e.g., 8 semesters)" },
  { value: "YEAR", label: "Year", description: "For multi-year programs (e.g., 4 years)" },
];

export default function FacultyManager() {
  const [showForm, setShowForm] = useState(false);
  const [selectedStudyLevelId, setSelectedStudyLevelId] = useState<string>("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType>("SEMESTER");
  const [totalUnits, setTotalUnits] = useState("8");

  const { data: levels, isLoading: levelsLoading } = useFetchStudyLevels();
  const { data: boards, isLoading: boardsLoading } = useFetchBoardsByStudyLevel(
    selectedStudyLevelId
  );
  const { data: faculties, isLoading: facultiesLoading, isError: facultiesError } =
    useFetchFacultiesByHierarchy(selectedStudyLevelId || null, selectedBoardId || null);

  const createMutation = useCreateFaculty();

  const handleAddFaculty = () => {
    if (
      newName.trim() &&
      selectedStudyLevelId &&
      selectedBoardId &&
      totalUnits &&
      parseInt(totalUnits) >= 1
    ) {
      createMutation.mutate({
        board_id: selectedBoardId,
        study_level_id: selectedStudyLevelId,
        name: newName,
        description: newDescription || undefined,
        unit_type: selectedUnitType,
        total_units: parseInt(totalUnits),
      });
      setNewName("");
      setNewDescription("");
      setTotalUnits("8");
      setSelectedUnitType("SEMESTER");
    }
  };

  const selectedLevel = levels?.find((l) => l.id === selectedStudyLevelId);
  const selectedBoard = boards?.find((b) => b.id === selectedBoardId);

  const isLoading = levelsLoading || boardsLoading || facultiesLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Faculties</h2>
        <p className="text-muted-foreground mt-1">
          Create faculties (streams/specializations) under boards. Example: CSIT, Science, Management, General
        </p>
      </div>

      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Step 1: Select Study Level & Board</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Study Level *
            </label>
            <select
              value={selectedStudyLevelId}
              onChange={(e) => {
                setSelectedStudyLevelId(e.target.value);
                setSelectedBoardId(""); // Reset board when level changes
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
              onChange={(e) => setSelectedBoardId(e.target.value)}
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
        </div>

        {selectedLevel && (
          <p className="text-sm text-muted-foreground">
            Showing faculties for <strong>{selectedLevel.name}</strong>
            {selectedBoard && ` > ${selectedBoard.name}`}
          </p>
        )}
      </div>

      {selectedStudyLevelId && selectedBoardId && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              + Add Faculty
            </button>
          ) : (
            <div className="border border-border rounded-lg p-4 bg-card space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Step 2: Create New Faculty</h3>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Faculty Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., CSIT, Science, Management, General"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description of this faculty"
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Unit Type *
                  </label>
                  <select
                    value={selectedUnitType}
                    onChange={(e) => setSelectedUnitType(e.target.value as UnitType)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {UNIT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {UNIT_TYPES.find((t) => t.value === selectedUnitType)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Total Units *
                  </label>
                  <input
                    type="number"
                    value={totalUnits}
                    onChange={(e) => setTotalUnits(e.target.value)}
                    min="1"
                    placeholder="e.g., 8 for 8 semesters"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Number of {selectedUnitType.toLowerCase()}s in this program
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddFaculty}
                  disabled={
                    createMutation.isPending ||
                    !newName.trim() ||
                    !totalUnits ||
                    parseInt(totalUnits) < 1
                  }
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setNewName("");
                    setNewDescription("");
                    setTotalUnits("8");
                    setSelectedUnitType("SEMESTER");
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
              {faculties?.length || 0} Facult{(faculties?.length || 0) !== 1 ? "ies" : "y"}
            </h3>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading faculties...</div>
              </div>
            )}

            {facultiesError && (
              <div className="p-4 bg-destructive/15 border border-destructive rounded-lg flex items-center gap-3">
                <FiAlertCircle className="text-destructive" size={20} />
                <span className="text-destructive">Failed to load faculties</span>
              </div>
            )}

            {!isLoading && !facultiesError && faculties && faculties.length === 0 && (
              <div className="p-8 text-center border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">
                  No faculties yet for {selectedLevel?.name} {" > "} {selectedBoard?.name}
                </p>
              </div>
            )}

            {!isLoading && faculties && faculties.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {faculties.map((faculty) => (
                  <FacultyCard key={faculty.id} faculty={faculty} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedStudyLevelId && selectedBoardId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            💡 <strong>Next Step:</strong> After creating faculties, add subjects under the faculties.
          </p>
        </div>
      )}
    </div>
  );
}

function FacultyCard({ faculty }: { faculty: Faculty }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-primary transition-colors">
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">{faculty.name}</h4>
        {faculty.description && (
          <p className="text-sm text-muted-foreground">{faculty.description}</p>
        )}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Unit Type:</strong> {faculty.unit_type}
          </p>
          <p>
            <strong>Total Units:</strong> {faculty.total_units}
          </p>
        </div>
        {!faculty.is_active && (
          <p className="text-xs text-destructive">Inactive</p>
        )}
      </div>
    </div>
  );
}
