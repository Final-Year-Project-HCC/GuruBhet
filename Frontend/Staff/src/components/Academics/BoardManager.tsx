/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import {
  useFetchStudyLevels,
  useFetchAllBoards,
  useCreateBoard,
  useDeleteBoard,
} from "@/hooks/useAcademics";
import { Board } from "@/lib/types";
import { Column, DataTable } from "./DataTable";
import { Modal } from "./Modal";

export default function BoardManager() {
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    item: Board | null;
  }>({
    isOpen: false,
    item: null,
  });

  const { data: allLevels } = useFetchStudyLevels();

  // Fetch all boards (no filtering)
  const {
    data: boards,
    isLoading: boardsLoading,
    isError: boardsError,
  } = useFetchAllBoards();

  const createMutation = useCreateBoard();
  const deleteMutation = useDeleteBoard();

  const handleAddBoard = () => {
    if (newName.trim() && selectedLevelIds.length > 0) {
      createMutation.mutate({
        name: newName,
        description: newDescription || undefined,
        studyLevelIds: selectedLevelIds,
      });
      setNewName("");
      setNewDescription("");
    }
  };

  const toggleLevelSelection = (levelId: string) => {
    setSelectedLevelIds((prev) =>
      prev.includes(levelId)
        ? prev.filter((id) => id !== levelId)
        : [...prev, levelId],
    );
  };

  const handleDeleteConfirm = () => {
    if (deleteModal.item) {
      deleteMutation.mutate(deleteModal.item.id);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "name" as const,
      label: "Board Name",
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
      key: "isActive" as const,
      label: "Status",
      render: (value: any) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === true
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
            }`}
        >
          {value === true ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Boards</h2>
        <p className="text-muted-foreground mt-1">
          Create boards (examination bodies or universities) and assign them to
          study levels. Example: NEB, Tribhuvan University, Kathmandu University
        </p>
      </div>

      {/* Study Level Selection */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          Step 1: Select Study Levels
        </h3>

        {!allLevels || allLevels.length === 0 ? (
          <div className="p-4 bg-muted/50 rounded text-sm text-muted-foreground text-center">
            📚 No study levels available. Create study levels first in the Study
            Levels tab.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allLevels.map((level) => (
              <label
                key={level.id}
                className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedLevelIds.includes(level.id)}
                  onChange={() => toggleLevelSelection(level.id)}
                  className="w-4 h-4 rounded cursor-pointer accent-primary"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {level.name}
                  </p>
                  {level.description && (
                    <p className="text-xs text-muted-foreground">
                      {level.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          ✓ {selectedLevelIds.length} level
          {selectedLevelIds.length !== 1 ? "s" : ""} selected
        </p>
      </div>

      {/* Creation Form - Always Visible But Disabled When No Level Selected */}
      <div
        className={`border border-border rounded-lg p-6 space-y-4 ${selectedLevelIds.length === 0 ? "opacity-60 pointer-events-none bg-muted/10" : "bg-card"}`}
      >
        <h3 className="text-lg font-semibold text-foreground">
          Step 2: Create New Board
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Board Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., NEB, Tribhuvan University"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              placeholder="Brief description"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <button
          onClick={handleAddBoard}
          disabled={createMutation.isPending || !newName.trim()}
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? "Creating..." : "+ Create Board"}
        </button>
      </div>

      {/* Data Table - Always Visible */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Boards ({boards?.length || 0})
        </h3>

        <DataTable<Board>
          data={boards}
          columns={columns}
          isLoading={boardsLoading}
          isError={boardsError}
          emptyStateText="No boards created yet. Create one using the form above."
          onDelete={(item) => setDeleteModal({ isOpen: true, item })}
          showActions={true}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        title="Delete Board"
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
