/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useFetchStudyLevels, useFetchBoardsByStudyLevel } from "@/hooks/useAcademics";
import { useFetchFacultiesByHierarchy, useCreateFaculty, useDeleteFaculty } from "@/hooks/useAcademics";
import { Faculty, UnitType, Board } from "@/lib/types";
import { Column, DataTable } from "./DataTable";
import { Modal } from "./Modal";

const UNIT_TYPES: { value: UnitType; label: string; description: string }[] = [
  { value: "GRADE", label: "Grade", description: "For school education (Grade 1-12)" },
  { value: "SEMESTER", label: "Semester", description: "For university programs (e.g., 8 semesters)" },
  { value: "YEAR", label: "Year", description: "For multi-year programs (e.g., 4 years)" },
];

export default function FacultyManager() {
  const [selectedStudyLevelId, setSelectedStudyLevelId] = useState<string>("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType>("SEMESTER");
  const [totalUnits, setTotalUnits] = useState("8");
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: Faculty | null }>({
    isOpen: false,
    item: null,
  });

  const { data: levels } = useFetchStudyLevels();
  const { data: boards } = useFetchBoardsByStudyLevel(
    selectedStudyLevelId
  );
  const { data: faculties, isLoading: facultiesLoading, isError: facultiesError } =
    useFetchFacultiesByHierarchy(selectedStudyLevelId || null, selectedBoardId || null);

  const createMutation = useCreateFaculty();
  const deleteMutation = useDeleteFaculty();

  const handleAddFaculty = () => {
    if (
      newName.trim() &&
      selectedStudyLevelId &&
      selectedBoardId &&
      totalUnits &&
      parseInt(totalUnits) >= 1
    ) {
      createMutation.mutate({
        boardId: selectedBoardId,
        studyLevelId: selectedStudyLevelId,
        name: newName,
        description: newDescription || undefined,
        unitType: selectedUnitType,
        totalUnits: parseInt(totalUnits),
      });
      setNewName("");
      setNewDescription("");
      setTotalUnits("8");
      setSelectedUnitType("SEMESTER");
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteModal.item) {
      deleteMutation.mutate(deleteModal.item.id);
    }
  };

  const selectedLevel = levels?.find((l) => l.id === selectedStudyLevelId);
  const selectedBoard = boards?.find((b: Board) => b.id === selectedBoardId);

  const isFormEnabled = !!selectedStudyLevelId && !!selectedBoardId;

  const columns: Column<any>[] = [
    {
      key: "name" as const,
      label: "Faculty Name",
      className: "font-medium",
    },
    {
      key: "description" as const,
      label: "Description",
      render: (value: any) => (
        value ? (
          <span className="text-sm text-muted-foreground">{value}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">—</span>
        )
      ),
    },
    {
      key: "unitType" as const,
      label: "Structure",
      render: (value: any) => (
        <span className="text-sm">{value ?? "—"}</span>
      ),
    },
    {
      key: "totalUnits" as const,
      label: "Total Units",
      render: (value: any) => (
        <span className="text-sm font-medium">{value ?? "—"}</span>
      ),
    },
    {
      key: "isActive" as const,
      label: "Status",
      render: (value: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === true
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
          }`}>
          {value === true ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Faculties</h2>
        <p className="text-muted-foreground mt-1">
          Create faculties (streams/specializations) under boards. Example: CSIT, Science, Management, General
        </p>
      </div>

      {/* Step 1: Hierarchy Selection */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Step 1: Select Study Level & Board</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
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
            <label className="block text-sm font-medium text-foreground mb-2">
              Board *
            </label>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              disabled={!selectedStudyLevelId || !boards || boards.length === 0}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a board...</option>
              {boards?.map((board: Board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Creation Form - Always Visible But Disabled When Needed */}
      <div className={`border border-border rounded-lg p-6 space-y-4 ${!isFormEnabled ? "opacity-60 pointer-events-none bg-muted/10" : "bg-card"}`}>
        <h3 className="text-lg font-semibold text-foreground">Step 2: Create New Faculty</h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Faculty Name *
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., CSIT, Science, Management, General"
            disabled={!isFormEnabled}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Brief description of this faculty"
            disabled={!isFormEnabled}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Structure *
            </label>
            <select
              value={selectedUnitType}
              onChange={(e) => setSelectedUnitType(e.target.value as UnitType)}
              disabled={!isFormEnabled}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
            <label className="block text-sm font-medium text-foreground mb-2">
              Total Units *
            </label>
            <input
              type="number"
              value={totalUnits}
              onChange={(e) => setTotalUnits(e.target.value)}
              min="1"
              placeholder="e.g., 8 for 8 semesters"
              disabled={!isFormEnabled}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of {selectedUnitType.toLowerCase()}s in this program
            </p>
          </div>
        </div>

        <button
          onClick={handleAddFaculty}
          disabled={
            !isFormEnabled ||
            createMutation.isPending ||
            !newName.trim() ||
            !totalUnits ||
            parseInt(totalUnits) < 1
          }
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? "Creating..." : "+ Create Faculty"}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        title="Delete Faculty"
        description={`Are you sure you want to delete "${deleteModal.item?.name}"? This action cannot be undone.`}
        isDangerous={true}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        primaryButtonText="Delete"
        primaryButtonLoading={deleteMutation.isPending}
        onPrimaryAction={handleDeleteConfirm}
        secondaryButtonText="Cancel"
      />

      {/* Data Table - Only Visible When Step 1 Complete */}
      {isFormEnabled && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Faculties for {selectedLevel?.name} in {selectedBoard?.name} ({faculties?.length || 0})
          </h3>

          <DataTable<Faculty>
            data={faculties}
            columns={columns}
            isLoading={facultiesLoading}
            isError={facultiesError}
            emptyStateText={`No faculties created yet for ${selectedLevel?.name} > ${selectedBoard?.name}. Create one using the form above.`}
            onDelete={(item) => setDeleteModal({ isOpen: true, item })}
            showActions={true}
          />
        </div>
      )}
    </div>
  );
}