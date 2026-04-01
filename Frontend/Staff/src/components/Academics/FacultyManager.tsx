"use client";

import { useState } from "react";
import {
  useFetchUniversities,
  useBulkCreateFaculty,
} from "@/lib/useAcademicDomains";
import { FiTrash2, FiPlus } from "react-icons/fi";

interface FacultyInput {
  tempId: number;
  name: string;
  numberOfSemesters: number;
}

export default function FacultyManager() {
  const [selectedUniversityId, setSelectedUniversityId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newSemesters, setNewSemesters] = useState("");
  const [faculties, setFaculties] = useState<FacultyInput[]>([]);
  const [nextTempId, setNextTempId] = useState(1);

  const { data: universities, isLoading: unisLoading } = useFetchUniversities();
  const bulkCreateMutation = useBulkCreateFaculty();

  const selectedUniversity = universities?.find((u) => u.id === selectedUniversityId);

  const handleAddFaculty = () => {
    if (newName.trim() && selectedUniversityId) {
      setFaculties([
        ...faculties,
        {
          tempId: nextTempId,
          name: newName,
          numberOfSemesters: parseInt(newSemesters),
        },
      ]);
      setNextTempId(nextTempId + 1);
      setNewName("");
      setNewSemesters("4");
    }
  };

  const handleRemove = (tempId: number) => {
    setFaculties(faculties.filter((f) => f.tempId !== tempId));
  };

  const handleSaveAll = () => {
    if (faculties.length > 0 && selectedUniversityId) {
      bulkCreateMutation.mutate({
        faculties: faculties.map((f) => ({
          universityId: selectedUniversityId,
          name: f.name,
          numberOfSemesters: f.numberOfSemesters,
        })),
      });
      setFaculties([]);
      setNewName("");
      setNewSemesters("");
      setSelectedUniversityId("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Faculties</h2>
        <p className="text-muted-foreground mt-1">
          Select a university and add multiple faculties with their semester count, then save all at once.
        </p>
      </div>

      {/* University Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Select University *
        </label>
        <select
          value={selectedUniversityId}
          onChange={(e) => setSelectedUniversityId(e.target.value)}
          disabled={unisLoading}
          className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {unisLoading ? "Loading universities..." : "Choose a university..."}
          </option>
          {universities?.map((uni) => (
            <option key={uni.id} value={uni.id}>
              {uni.name}
            </option>
          ))}
        </select>
        {!selectedUniversityId && !unisLoading && universities && universities.length === 0 && (
          <p className="text-sm text-destructive">⚠️ No universities found. Create one first.</p>
        )}
      </div>

      {/* Add Faculty Form */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <h3 className="font-semibold text-foreground">
          {selectedUniversity ? `Add Faculties to ${selectedUniversity.name}` : "Add Faculties"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Faculty Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!selectedUniversityId}
              placeholder="e.g., Faculty of Engineering"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Total Semesters *
            </label>
            <select
              value={newSemesters}
              onChange={(e) => setNewSemesters(e.target.value)}
              disabled={!selectedUniversityId}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">Select semesters...</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num} Semester{num !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAddFaculty}
              disabled={!newName.trim() || !selectedUniversityId || !newSemesters}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FiPlus size={18} />
              Add to List
            </button>
          </div>
        </div>
      </div>

      {/* Faculties List */}
      {faculties.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Faculties to Add ({faculties.length})
          </h3>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Faculty Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Semesters</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {faculties.map((faculty, idx) => (
                  <tr key={faculty.tempId} className={idx % 2 === 0 ? "bg-background" : "bg-muted/50"}>
                    <td className="px-4 py-3 text-foreground">{faculty.name}</td>
                    <td className="px-4 py-3 text-foreground">{faculty.numberOfSemesters}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(faculty.tempId)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={bulkCreateMutation.isPending}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkCreateMutation.isPending ? "Saving..." : "Save All Faculties"}
          </button>
        </div>
      )}
    </div>
  );
}
