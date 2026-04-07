"use client";

import { useState } from "react";
import { useFetchStudyLevels, useCreateStudyLevel } from "@/lib/useAcademics";
import { StudyLevel } from "@/lib/types";
import { FiAlertCircle } from "react-icons/fi";

export default function StudyLevelManager() {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const { data: levels, isLoading, isError } = useFetchStudyLevels();
  const createMutation = useCreateStudyLevel();

  const handleAddLevel = () => {
    if (newName.trim()) {
      createMutation.mutate({
        name: newName,
        description: newDescription || undefined,
      });
      setNewName("");
      setNewDescription("");
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Study Levels</h2>
        <p className="text-muted-foreground mt-1">
          Create different study levels. Examples: Primary Level (1-6), +2, Bachelor, Master, PhD
        </p>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          + Add Study Level
        </button>
      ) : (
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Level Name *
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
            <label className="block text-sm font-medium text-foreground mb-1">
              Description (Optional)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description of this study level"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddLevel}
              disabled={createMutation.isPending || !newName.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewName("");
                setNewDescription("");
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
          {levels?.length || 0} Level{(levels?.length || 0) !== 1 ? "s" : ""}
        </h3>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading study levels...</div>
          </div>
        )}

        {isError && (
          <div className="p-4 bg-destructive/15 border border-destructive rounded-lg flex items-center gap-3">
            <FiAlertCircle className="text-destructive" size={20} />
            <span className="text-destructive">Failed to load study levels</span>
          </div>
        )}

        {!isLoading && !isError && levels && levels.length === 0 && (
          <div className="p-8 text-center border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">No study levels yet. Create one to get started!</p>
          </div>
        )}

        {!isLoading && levels && levels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {levels.map((level) => (
              <StudyLevelCard key={level.id} level={level} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          💡 <strong>Next Step:</strong> After creating study levels, add boards that offer these levels.
        </p>
      </div>
    </div>
  );
}

function StudyLevelCard({ level }: { level: StudyLevel }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-primary transition-colors">
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">{level.name}</h4>
        {level.description && (
          <p className="text-sm text-muted-foreground">{level.description}</p>
        )}
        {!level.is_active && (
          <p className="text-xs text-destructive">Inactive</p>
        )}
      </div>
    </div>
  );
}
