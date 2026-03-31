"use client";

import { useState, useMemo } from "react";
import {
  useFetchUniversities,
  useFetchFacultiesByUniversity,
  useFetchSemestersByFaculty,
  useCreateSemester,
  useBulkCreateSubject,
} from "@/lib/useAcademicDomains";
import { FiPlus, FiTrash2 } from "react-icons/fi";

interface SubjectInput {
  tempId: number;
  name: string;
}

export default function SubjectManager() {
  const [selectedUniversityId, setSelectedUniversityId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [subjects, setSubjects] = useState<SubjectInput[]>([]);
  const [nextTempId, setNextTempId] = useState(1);

  const { data: universities, isLoading: unisLoading } = useFetchUniversities();
  const { data: faculties, isLoading: facLoading } = useFetchFacultiesByUniversity(
    selectedUniversityId || null
  );
  const { data: semesters } = useFetchSemestersByFaculty(
    selectedUniversityId || null,
    selectedFacultyId || null
  );

  const createSemesterMutation = useCreateSemester();
  const bulkCreateSubjectMutation = useBulkCreateSubject();

  const selectedUniversity = universities?.find((u) => u.id === selectedUniversityId);
  const selectedFaculty = faculties?.find((f) => f.id === selectedFacultyId);
  const selectedSemester = semesters?.find((s) => s.id === selectedSemesterId);
  const maxSemesters = selectedFaculty?.numberOfSemesters || 0;
  const existingSemesterNumbers = useMemo(() => {
    return new Set((semesters || []).map((s) => s.semesterNumber));
  }, [semesters]);

  const handleCreateSemester = (semesterNumber: number) => {
    if (selectedUniversityId && selectedFacultyId) {
      createSemesterMutation.mutate({
        universityId: selectedUniversityId,
        facultyId: selectedFacultyId,
        semesterNumber,
      });
    }
  };

  const handleAddSubject = () => {
    if (newSubjectName.trim() && selectedSemesterId) {
      setSubjects([
        ...subjects,
        {
          tempId: nextTempId,
          name: newSubjectName,
        },
      ]);
      setNextTempId(nextTempId + 1);
      setNewSubjectName("");
    }
  };

  const handleRemoveSubject = (tempId: number) => {
    setSubjects(subjects.filter((s) => s.tempId !== tempId));
  };

  const handleSaveAllSubjects = () => {
    if (subjects.length > 0 && selectedUniversityId && selectedFacultyId && selectedSemesterId) {
      bulkCreateSubjectMutation.mutate({
        subjects: subjects.map((s) => ({
          universityId: selectedUniversityId,
          facultyId: selectedFacultyId,
          semesterId: selectedSemesterId,
          name: s.name,
        })),
      });
      setSubjects([]);
      setNewSubjectName("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Subjects</h2>
        <p className="text-muted-foreground mt-1">
          Select university, faculty, and semester, then add multiple subjects at once.
        </p>
      </div>

      {/* Step 1: University Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Select University *
        </label>
        <select
          value={selectedUniversityId}
          onChange={(e) => {
            setSelectedUniversityId(e.target.value);
            setSelectedFacultyId("");
            setSelectedSemesterId("");
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

      {/* Step 2: Faculty Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Select Faculty *
        </label>
        <select
          value={selectedFacultyId}
          onChange={(e) => {
            setSelectedFacultyId(e.target.value);
            setSelectedSemesterId("");
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

      {/* Step 3: Semester Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Select Semester *
        </label>
        <select
          value={selectedSemesterId}
          onChange={(e) => setSelectedSemesterId(e.target.value)}
          disabled={!selectedFacultyId}
          className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {!selectedFacultyId ? "Select a faculty first..." : "Choose a semester..."}
          </option>
          {semesters?.map((sem) => (
            <option key={sem.id} value={sem.id}>
              Semester {sem.semesterNumber}
            </option>
          ))}
        </select>
      </div>

      {/* Step 4: Semester Management & Creation */}
      {selectedFaculty && (
        <div className="space-y-4 border border-border rounded-lg p-6 bg-card">
          <div>
            <h3 className="font-semibold text-foreground mb-3">
              Semesters for {selectedFaculty.name}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Array.from({ length: maxSemesters }, (_, i) => i + 1).map((semNum) => (
                <div key={semNum}>
                  {existingSemesterNumbers.has(semNum) ? (
                    <button
                      disabled
                      className="w-full px-3 py-2.5 bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-100 rounded-lg font-medium border border-green-300 dark:border-green-700 text-sm"
                    >
                      ✓ Sem {semNum}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCreateSemester(semNum)}
                      disabled={createSemesterMutation.isPending}
                      className="w-full px-3 py-2.5 bg-background border border-border text-foreground rounded-lg font-medium hover:border-primary hover:bg-muted transition-colors disabled:opacity-50 text-sm"
                    >
                      + Sem {semNum}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Add Subjects */}
      {selectedSemester && (
        <div className="space-y-4 border border-border rounded-lg p-6 bg-blue-50 dark:bg-blue-950">
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold mb-1">
              Adding subjects for: {selectedUniversity?.name} → {selectedFaculty?.name} → Semester {selectedSemester.semesterNumber}
            </p>
          </div>
        </div>
      )}

      {/* Add Subject Form */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <h3 className="font-semibold text-foreground">Add Subjects</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Subject Name *
            </label>
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="e.g., Advanced Calculus"
              disabled={!selectedSemesterId}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAddSubject}
              disabled={!newSubjectName.trim() || !selectedSemesterId}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FiPlus size={18} />
              Add to List
            </button>
          </div>
        </div>
      </div>

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
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, idx) => (
                  <tr key={subject.tempId} className={idx % 2 === 0 ? "bg-background" : "bg-muted/50"}>
                    <td className="px-4 py-3 text-foreground">{subject.name}</td>
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
