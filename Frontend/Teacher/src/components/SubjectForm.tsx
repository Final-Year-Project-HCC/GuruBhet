"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { X } from "lucide-react";
import apiClient from "@/lib/api";

interface University {
  id: string;
  name: string;
}

interface Faculty {
  id: string;
  universityId: string;
  name: string;
  numberOfSemesters: number;
}

interface Subject {
  id: string;
  name: string;
  universityId: string;
  facultyId: string;
  semesterNumber: number;
  isActive: boolean;
}

interface TeacherSubject {
  teacherId: string;
  subjectId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  totalSessionsCompleted: number;
  avgRating: number;
  ratingCount: number;
  isActive: boolean;
  subject: Subject;
}

interface SubjectFormState {
  universityId: string;
  facultyId: string;
  semesterNumber: string;
  subjectId: string;
  ratePerSession: string;
  yearsOfExperience: string;
}

export default function SubjectForm() {
  const [formState, setFormState] = useState<SubjectFormState>({
    universityId: "",
    facultyId: "",
    semesterNumber: "",
    subjectId: "",
    ratePerSession: "",
    yearsOfExperience: "0",
  });

  // Step 1: Fetch all universities
  const universitiesQuery = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await apiClient.get("/academic/universities");
      return data as University[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Step 2: Fetch faculties for selected university
  const facultiesQuery = useQuery({
    queryKey: ["faculties", formState.universityId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/academic/universities/${formState.universityId}/faculties`
      );
      return data as Faculty[];
    },
    enabled: !!formState.universityId,
    staleTime: 1000 * 60 * 10,
  });

  // Step 3: Generate semester array from faculty.numberOfSemesters
  const semesters = useMemo(() => {
    if (!formState.facultyId || !facultiesQuery.data) return [];
    const faculty = facultiesQuery.data.find((f) => f.id === formState.facultyId);
    if (!faculty) return [];
    return Array.from({ length: faculty.numberOfSemesters }, (_, i) => (i + 1).toString());
  }, [formState.facultyId, facultiesQuery.data]);

  // Step 4: Fetch subjects for selected faculty
  const facultySubjectsQuery = useQuery({
    queryKey: ["faculty-subjects", formState.universityId, formState.facultyId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/academic/universities/${formState.universityId}/faculties/${formState.facultyId}/subjects`
      );
      return data as Subject[];
    },
    enabled: !!formState.universityId && !!formState.facultyId,
    staleTime: 1000 * 60 * 10,
  });

  // Step 5: Filter subjects by semesterNumber
  const filteredSubjects = useMemo(() => {
    if (!facultySubjectsQuery.data || !formState.semesterNumber) return [];
    const semesterNum = parseInt(formState.semesterNumber, 10);
    return facultySubjectsQuery.data.filter(
      (subject) => subject.semesterNumber === semesterNum && subject.isActive
    );
  }, [facultySubjectsQuery.data, formState.semesterNumber]);

  // Fetch teacher's existing subjects
  const teacherSubjectsQuery = useQuery({
    queryKey: ["teacher-subjects"],
    queryFn: async () => {
      const { data } = await apiClient.get("/teachers/me/subjects");
      return data as TeacherSubject[];
    },
    staleTime: 1000 * 60 * 2,
  });

  function handleFormChange(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    const { name, value } = e.target;

    // Reset dependent fields when parent selection changes
    if (name === "universityId") {
      setFormState((prev) => ({
        ...prev,
        universityId: value,
        facultyId: "",
        semesterNumber: "",
        subjectId: "",
      }));
    } else if (name === "facultyId") {
      setFormState((prev) => ({
        ...prev,
        facultyId: value,
        semesterNumber: "",
        subjectId: "",
      }));
    } else if (name === "semesterNumber") {
      setFormState((prev) => ({
        ...prev,
        semesterNumber: value,
        subjectId: "",
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  }

  // Add subject mutation
  const addSubjectMutation = useMutation({
    mutationFn: async (payload: { subjectId: string; ratePerSession: number; yearsOfExperience: number }) => {
      const { data } = await apiClient.post("/teachers/me/subjects", payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Subject added successfully");
      setFormState({
        universityId: "",
        facultyId: "",
        semesterNumber: "",
        subjectId: "",
        ratePerSession: "",
        yearsOfExperience: "0",
      });
      teacherSubjectsQuery.refetch();
    },
    onError: (err: unknown) => {
      let message = "Failed to add subject";
      if (axios.isAxiosError(err)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message = (err.response?.data as any)?.detail || err.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      toast.error(message);
    },
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (subjectId: string) => {
      await apiClient.delete(`/teachers/me/subjects/${subjectId}`);
    },
    onSuccess: () => {
      toast.success("Subject removed successfully");
      teacherSubjectsQuery.refetch();
    },
    onError: (err: unknown) => {
      let message = "Failed to remove subject";
      if (axios.isAxiosError(err)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message = (err.response?.data as any)?.detail || err.message || message;
      }
      toast.error(message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formState.subjectId) {
      toast.error("Please select a subject");
      return;
    }

    if (!formState.ratePerSession) {
      toast.error("Please enter rate per session");
      return;
    }

    const rate = parseFloat(formState.ratePerSession);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }

    const experience = parseInt(formState.yearsOfExperience, 10);
    if (isNaN(experience) || experience < 0) {
      toast.error("Years of experience must be a non-negative number");
      return;
    }

    addSubjectMutation.mutate({
      subjectId: formState.subjectId,
      ratePerSession: rate,
      yearsOfExperience: experience,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Add Subjects You Can Teach</h2>

        {/* Cascading Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* University Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">University</label>
            <select
              name="universityId"
              value={formState.universityId}
              onChange={handleFormChange}
              disabled={universitiesQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {universitiesQuery.isLoading ? "Loading..." : "Select University"}
              </option>
              {universitiesQuery.data?.map((uni) => (
                <option key={uni.id} value={uni.id}>
                  {uni.name}
                </option>
              ))}
            </select>
          </div>

          {/* Faculty Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Faculty</label>
            <select
              name="facultyId"
              value={formState.facultyId}
              onChange={handleFormChange}
              disabled={!formState.universityId || facultiesQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.universityId
                  ? "Select University first"
                  : facultiesQuery.isLoading
                    ? "Loading..."
                    : "Select Faculty"}
              </option>
              {facultiesQuery.data?.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Semester</label>
            <select
              name="semesterNumber"
              value={formState.semesterNumber}
              onChange={handleFormChange}
              disabled={!formState.facultyId}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.facultyId ? "Select Faculty first" : "Select Semester"}
              </option>
              {semesters.map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Subject</label>
            <select
              name="subjectId"
              value={formState.subjectId}
              onChange={handleFormChange}
              disabled={!formState.semesterNumber || facultySubjectsQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.semesterNumber
                  ? "Select Semester first"
                  : facultySubjectsQuery.isLoading
                    ? "Loading..."
                    : "Select Subject"}
              </option>
              {filteredSubjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rate per Session */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Rate per Session (NPR)</label>
            <input
              type="number"
              name="ratePerSession"
              value={formState.ratePerSession}
              onChange={handleFormChange}
              placeholder="Enter rate"
              min="0"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          {/* Years of Experience */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Years of Experience</label>
            <input
              type="number"
              name="yearsOfExperience"
              value={formState.yearsOfExperience}
              onChange={handleFormChange}
              placeholder="0"
              min="0"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          {/* Add Button */}
          <button
            type="submit"
            disabled={addSubjectMutation.isPending || !formState.subjectId}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {addSubjectMutation.isPending ? "Adding..." : "Add Subject"}
          </button>
        </form>
      </div>

      {/* List of Added Subjects */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Your Subjects</h3>
        {teacherSubjectsQuery.isLoading ? (
          <p className="text-muted-foreground">Loading subjects...</p>
        ) : teacherSubjectsQuery.data?.length === 0 ? (
          <p className="text-muted-foreground">No subjects added yet</p>
        ) : (
          <div className="space-y-2">
            {teacherSubjectsQuery.data?.map((ts) => (
              <div
                key={ts.subjectId}
                className="flex items-center justify-between rounded-md border border-border bg-muted px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{ts.subject.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Rs. {ts.ratePerSession.toLocaleString()} per session • {ts.yearsOfExperience} years experience
                  </p>
                  {ts.subject.semesterNumber && (
                    <p className="text-xs text-muted-foreground">
                      Semester {ts.subject.semesterNumber}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteSubjectMutation.mutate(ts.subjectId)}
                  disabled={deleteSubjectMutation.isPending}
                  className="rounded-md bg-destructive/10 p-2 hover:bg-destructive/20 disabled:opacity-50"
                  title="Remove subject"
                >
                  <X className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
