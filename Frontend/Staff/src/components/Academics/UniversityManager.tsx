"use client";

import { useState } from "react";
import { useFetchUniversities, useCreateUniversity } from "@/lib/useAcademicDomains";
import { University } from "@/lib/types";
import { FiCheck, FiAlertCircle } from "react-icons/fi";

export default function UniversityManager() {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const { data: universities, isLoading, isError } = useFetchUniversities();
  const createMutation = useCreateUniversity();

  const handleAddUniversity = () => {
    if (newName.trim()) {
      createMutation.mutate({
        name: newName,
        description: newDescription,
      });
      setNewName("");
      setNewDescription("");
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Universities</h2>
        <p className="text-muted-foreground mt-1">
          Create and manage universities in the system. All universities will be available for faculty, semester, and subject assignments.
        </p>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          + Add University
        </button>
      ) : (
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              University Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Tribhuvan University"
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
              placeholder="Brief description of the university"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddUniversity}
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
          {universities?.length || 0} Universit{(universities?.length || 0) !== 1 ? "ies" : "y"}
        </h3>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading universities...</div>
          </div>
        )}

        {isError && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-3">
            <FiAlertCircle className="text-destructive" size={20} />
            <span className="text-destructive">Failed to load universities</span>
          </div>
        )}

        {!isLoading && !isError && universities && universities.length === 0 && (
          <div className="p-8 text-center border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">No universities yet. Create one to get started!</p>
          </div>
        )}

        {!isLoading && universities && universities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {universities.map((university) => (
              <UniversityCard key={university.id} university={university} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          💡 <strong>Next Step:</strong> After creating universities, you&apos;ll be able to add faculties by selecting a university.
        </p>
      </div>
    </div>
  );
}

function UniversityCard({ university }: { university: University }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-primary transition-colors">
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">{university.name}</h4>
        {university.description && (
          <p className="text-sm text-muted-foreground">{university.description}</p>
        )}
      </div>
    </div>
  );
}
