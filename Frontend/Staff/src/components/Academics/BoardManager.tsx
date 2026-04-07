"use client";

import { useState } from "react";
import { useFetchStudyLevels } from "@/lib/useAcademics";
import { useFetchBoardsByStudyLevel, useCreateBoard } from "@/lib/useAcademics";
import { Board } from "@/lib/types";
import { FiAlertCircle } from "react-icons/fi";

export default function BoardManager() {
  const [showForm, setShowForm] = useState(false);
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: allLevels } = useFetchStudyLevels();
  
  // Get boards for the first selected level (for display purposes)
  const firstSelectedLevel = selectedLevelIds[0];
  const { data: boards, isLoading: boardsLoading, isError: boardsError } = useFetchBoardsByStudyLevel(firstSelectedLevel || null);
  
  const createMutation = useCreateBoard();

  const handleAddBoard = () => {
    if (newName.trim() && selectedLevelIds.length > 0) {
      createMutation.mutate({
        name: newName,
        description: newDescription || undefined,
        study_level_ids: selectedLevelIds,
      });
      setNewName("");
      setNewDescription("");
      setSelectedLevelIds([]);
      setShowForm(false);
    }
  };

  const toggleLevelSelection = (levelId: string) => {
    setSelectedLevelIds((prev) =>
      prev.includes(levelId)
        ? prev.filter((id) => id !== levelId)
        : [...prev, levelId]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Boards</h2>
        <p className="text-muted-foreground mt-1">
          Create boards (examination bodies or universities) and assign them to study levels. Example: NEB, Tribhuvan University, Kathmandu University
        </p>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          + Add Board
        </button>
      ) : (
        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Study Levels * (This board will offer these levels)
            </label>
            {!allLevels || allLevels.length === 0 ? (
              <div className="p-3 bg-muted/50 rounded text-sm text-muted-foreground">
                No study levels available. Create study levels first.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3 bg-background">
                {allLevels.map((level) => (
                  <label key={level.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedLevelIds.includes(level.id)}
                      onChange={() => toggleLevelSelection(level.id)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-sm text-foreground">{level.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedLevelIds.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {selectedLevelIds.length} level(s) selected
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Board Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., NEB, Tribhuvan University, Kathmandu University"
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
              placeholder="Brief description of the board"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddBoard}
              disabled={createMutation.isPending || !newName.trim() || selectedLevelIds.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewName("");
                setNewDescription("");
                setSelectedLevelIds([]);
              }}
              className="px-4 py-2 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedLevelIds.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Boards for {allLevels?.find(l => l.id === selectedLevelIds[0])?.name} ({boards?.length || 0})
          </h3>

          {boardsLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading boards...</div>
            </div>
          )}

          {boardsError && (
            <div className="p-4 bg-destructive/15 border border-destructive rounded-lg flex items-center gap-3">
              <FiAlertCircle className="text-destructive" size={20} />
              <span className="text-destructive">Failed to load boards</span>
            </div>
          )}

          {!boardsLoading && !boardsError && boards && boards.length === 0 && (
            <div className="p-8 text-center border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground">No boards for this study level yet.</p>
            </div>
          )}

          {!boardsLoading && boards && boards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {boards.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          💡 <strong>Next Step:</strong> After creating boards, add faculties under the boards.
        </p>
      </div>
    </div>
  );
}

function BoardCard({ board }: { board: Board }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-primary transition-colors">
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground">{board.name}</h4>
        {board.description && (
          <p className="text-sm text-muted-foreground">{board.description}</p>
        )}
        {board.study_levels && board.study_levels.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Study Levels:</p>
            <div className="flex flex-wrap gap-1">
              {board.study_levels.map((level) => (
                <span
                  key={level.id}
                  className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                >
                  {level.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {!board.is_active && (
          <p className="text-xs text-destructive">Inactive</p>
        )}
      </div>
    </div>
  );
}
