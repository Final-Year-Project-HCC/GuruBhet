/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useFetchStudyLevels, useCreateStudyLevel, useDeleteStudyLevel } from "@/hooks/useAcademics";
import { StudyLevel } from "@/lib/types";
import { Column, DataTable } from "./DataTable";
import { Modal } from "./Modal";

export default function StudyLevelManager() {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: StudyLevel | null }>({
    isOpen: false,
    item: null,
  });

  const { data: levels, isLoading, isError } = useFetchStudyLevels();
  const createMutation = useCreateStudyLevel();
  const deleteMutation = useDeleteStudyLevel();

  const handleAddLevel = () => {
    if (newName.trim()) {
      createMutation.mutate({
        name: newName,
        description: newDescription || undefined,
      });
      setNewName("");
      setNewDescription("");
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteModal.item) {
      deleteMutation.mutate(deleteModal.item.id);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "name" as const,
      label: "Name",
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
        <h2 className="text-2xl font-bold text-foreground">Study Levels</h2>
        <p className="text-muted-foreground mt-1">
          Create different study levels. Examples: Primary Level (1-6), +2, Bachelor, Master, PhD
        </p>
      </div>

      {/* Creation Form - Always Visible */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Create New Study Level</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Level *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Bachelor, Primary Level (1-6), +2"
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
              placeholder="Brief description of this study level"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <button
          onClick={handleAddLevel}
          disabled={createMutation.isPending || !newName.trim()}
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? "Creating..." : "+ Create Study Level"}
        </button>
      </div>

      {/* Data Table */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {levels?.length || 0} Study Level{(levels?.length || 0) !== 1 ? "s" : ""}
        </h3>

        <DataTable<StudyLevel>
          data={levels}
          columns={columns}
          isLoading={isLoading}
          isError={isError}
          emptyStateText="No study levels created yet. Create one using the form above."
          onDelete={(item) => setDeleteModal({ isOpen: true, item })}
          showActions={true}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        title="Delete Study Level"
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
