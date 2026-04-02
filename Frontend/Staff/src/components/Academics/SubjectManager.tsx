"use client";

import { useState } from "react";
import {
  useFetchUniversities,
  useFetchFacultiesByUniversity,
  useBulkCreateSubject,
} from "@/lib/useAcademicDomains";
import { FiPlus, FiTrash2 } from "react-icons/fi";

interface SubjectInput {
  tempId: number;
  name: string;
  className?: string;
}

export default function SubjectManager() {
  const [selectedUniversityId, setSelectedUniversityId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [semesterNumber, setSemesterNumber] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [nextTempId, setNextTempId] = useState(1);

  const { data: universities, isLoading: unisLoading } = useFetchUniversities();
  const { data: faculties, isLoading: facLoading } = useFetchFacultiesByUniversity(
    selectedUniversityId || null
  );
  const bulkCreateSubjectMutation = useBulkCreateSubject();

  const selectedUniversity = universities?.find((u) => u.id === selectedUniversityId);
  const selectedFaculty = faculties?.find((f) => f.id === selectedFacultyId);
  const maxSemesters = selectedFaculty?.numberOfSemesters || 0;

  const handleAddSubject = () => {
    if (newSubjectName.trim() && semesterNumber && selectedFacultyId) {
      setSubjects([
        ...subjects,
        {
          tempId: nextTempId,
          name: newSubjectName,
          className: newClassName || undefined,
        },
      ]);
      setNextTempId(nextTempId + 1);
      setNewSubjectName("");
      setNewClassName("");
    }
  };

  const handleRemoveSubject = (tempId: number) => {
    setSubjects(subjects.filter((s) => s.tempId !== tempId));
  };

  const handleSaveAllSubjects = () => {
    if (subjects.length > 0 && selectedUniversityId && selectedFacultyId && semesterNumber) {
      bulkCreateSubjectMutation.mutate({
        subjects: subjects.map((s) => ({
          universityId: selectedUniversityId,
          facultyId: selectedFacultyId,
          semesterNumber: parseInt(semesterNumber),
          name: s.name,
          className: s.className,
        })),
      });
      setSubjects([]);
      setNewSubjectName("");
      setNewClassName("");
      setSemesterNumber("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Subjects</h2>
        <p className="text-muted-foreground mt-1">
          Select university and faculty, specify a semester number, then add multiple subjects at once.
        </p>
      </div>

      {/* University Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Select University *
        </label>
        <select
          value={selectedUniversityId}
          onChange={(e) => {
            setSelectedUniversityId(e.target.value);
            setSelectedFacultyId("");
            setSemesterNumber("");
          }}
          disabled={unisLoading}
          className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {unisLoading ? "Loading..." : "Choose a university..."}
          </option>
          {universities?.map((uni) => (
            <option key={uni.id} value={uni.id}>
              {uni.name}
            </option>
          ))}
        </select>
      </div>

      {/* Faculty Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Select Faculty *
        </label>
        <select
          value={selectedFacultyId}
          onChange={(e) => {
            setSelectedFacultyId(e.target.value);
            setSemesterNumber("");
          }}
          disabled={!selectedUniversityId || facLoading}
          className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {!selectedUniversityId ? "Select a university first..." : facLoading ? "Loading..." : "Choose a faculty..."}
          </option>
          {faculties?.map((fac) => (
            <option key={fac.id} value={fac.id}>
              {fac.name} ({fac.numberOfSemesters} semesters)
            </option>
          ))}
        </select>
      </div>

      {/* Semester Number Selection */}
      {selectedFaculty && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Select Semester Number (1 to {maxSemesters}) *
          </label>
          <select
            value={semesterNumber}
            onChange={(e) => setSemesterNumber(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Choose a semester...</option>
            {Array.from({ length: maxSemesters }, (_, i) => i + 1).map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Add Subject Form */}
      {selectedFaculty && semesterNumber && (
        <div className="border border-border rounded-lg p-6 bg-blue-50 dark:bg-blue-950 space-y-4">
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold">
              {selectedUniversity?.name} → {selectedFaculty?.name} → Semester {semesterNumber}
            </p>
          </div>

          <div className="border-t border-blue-200 dark:border-blue-800 pt-4 space-y-4">
            <h3 className="font-semibold text-foreground">Add Subjects</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g., Advanced Calculus"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Class Name (Optional)
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., BScCSIT-4A"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={handleAddSubject}
                disabled={!newSubjectName.trim()}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FiPlus size={18} />
                Add to List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subjects List */}
      {subjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Subjects to Add ({subjects.length})
          </h3>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Subject Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Class Name</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, idx) => (
                  <tr key={subject.tempId} className={idx % 2 === 0 ? "bg-background" : "bg-muted/50"}>
                    <td className="px-4 py-3 text-foreground">{subject.name}</td>
                    <td className="px-4 py-3 text-foreground text-muted-foreground">
                      {subject.className || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveSubject(subject.tempId)}
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
            onClick={handleSaveAllSubjects}
            disabled={bulkCreateSubjectMutation.isPending}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkCreateSubjectMutation.isPending ? "Saving..." : "Save All Subjects"}
          </button>
        </div>
      )}
    </div>
  );
}
