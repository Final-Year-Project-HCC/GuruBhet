/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { useFetchStudyLevels, useFetchBoardsByStudyLevel } from "@/hooks/useAcademics";
import { useFetchFacultiesByHierarchy, useFetchSubjectsByHierarchy, useCreateSubject, useDeleteSubject } from "@/hooks/useAcademics";
import { Subject, Board } from "@/lib/types";
import { Column, DataTable } from "./DataTable";
import { Modal } from "./Modal";

export default function SubjectManager() {
  const [selectedStudyLevelId, setSelectedStudyLevelId] = useState<string>("");
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [unitValue, setUnitValue] = useState("1");
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: Subject | null }>({
    isOpen: false,
    item: null,
  });

  const { data: levels } = useFetchStudyLevels();
  const { data: boards } = useFetchBoardsByStudyLevel(
    selectedStudyLevelId
  );
  const { data: faculties } = useFetchFacultiesByHierarchy(
    selectedStudyLevelId || null,
    selectedBoardId || null
  );
  const { data: subjects, isLoading: subjectsLoading, isError: subjectsError } =
    useFetchSubjectsByHierarchy(
      selectedFacultyId || null
    );

  const createMutation = useCreateSubject();
  const deleteMutation = useDeleteSubject();

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
        facultyId: selectedFacultyId,
        unitValue: parseInt(unitValue),
      });
      setNewName("");
      setUnitValue("1");
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteModal.item) {
      deleteMutation.mutate(deleteModal.item.id);
    }
  };


  const selectedFaculty = faculties?.find((f) => f.id === selectedFacultyId);
  const maxUnits = selectedFaculty?.totalUnits || 1;
  const isFormEnabled = !!selectedStudyLevelId && !!selectedBoardId && !!selectedFacultyId;

  const columns: Column<any>[] = [
    {
      key: "name" as const,
      label: "Subject Name",
      className: "font-medium",
    },
    {
      key: "unitValue" as const,
      label: "Unit Value",
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
        <h2 className="text-2xl font-bold text-foreground">Subjects</h2>
        <p className="text-muted-foreground mt-1">
          Create subjects by selecting a study level, board, and faculty. Then specify the unit value (grade/semester/year number).
        </p>
      </div>

      {/* Step 1: Hierarchy Selection */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Step 1: Select Hierarchy</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
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
            <label className="block text-sm font-medium text-foreground mb-2">
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
              {boards?.map((board: Board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
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

        {selectedFaculty && (
          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
            📚 {selectedFaculty.name} • {selectedFaculty.unitType} (1 to {maxUnits})
          </p>
        )}
      </div>

      {/* Step 2: Creation Form - Always Visible but Disabled When Needed */}
      <div className={`border border-border rounded-lg p-6 space-y-4 ${!isFormEnabled ? "opacity-60 pointer-events-none bg-muted/10" : "bg-card"}`}>
        <h3 className="text-lg font-semibold text-foreground">Step 2: Create New Subject</h3>

        {!isFormEnabled && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-900 dark:text-blue-100">
            👆 Select study level, board, and faculty above to create a subject
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Subject Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Mathematics, Chemistry, Data Structures"
              disabled={!isFormEnabled}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Unit Value (1 to {maxUnits}) *
            </label>
            <input
              type="number"
              value={unitValue}
              onChange={(e) => setUnitValue(e.target.value)}
              min="1"
              max={maxUnits}
              placeholder={`e.g., 5 (for semester 5 or year 5, etc.)`}
              disabled={!isFormEnabled}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <button
          onClick={handleAddSubject}
          disabled={
            !isFormEnabled ||
            createMutation.isPending ||
            !newName.trim() ||
            !unitValue ||
            parseInt(unitValue) < 1 ||
            parseInt(unitValue) > maxUnits
          }
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? "Creating..." : "+ Create Subject"}
        </button>
      </div>

      {/* Data Table */}
      {isFormEnabled && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {subjects?.length || 0} Subject{(subjects?.length || 0) !== 1 ? "s" : ""}
          </h3>

          <DataTable<Subject>
            data={subjects}
            columns={columns}
            isLoading={subjectsLoading}
            isError={subjectsError}
            emptyStateText={`No subjects created yet for ${selectedFaculty?.name}`}
            onDelete={(item) => setDeleteModal({ isOpen: true, item })}
            showActions={true}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        title="Delete Subject"
        description={`Are you sure you want to delete "${deleteModal.item?.name}"? This action cannot be undone.`}
        isDangerous={true}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        primaryButtonText="Delete"
        primaryButtonLoading={deleteMutation.isPending}
        onPrimaryAction={handleDeleteConfirm}
        secondaryButtonText="Cancel"
      />
    </div>
  );
}
