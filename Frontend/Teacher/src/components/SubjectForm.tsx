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
  university_id: string;
  name: string;
  number_of_semesters: number;
}

interface Subject {
  id: string;
  name: string;
  university_id: string;
  faculty_id: string;
  semester_number: number;
  is_active: boolean;
}

interface TeacherSubject {
  teacher_id: string;
  subject_id: string;
  rate_per_session: number;
  years_of_experience: number;
  total_sessions_completed: number;
  avg_rating: number;
  rating_count: number;
  is_active: boolean;
  subject: Subject;
}

interface SubjectFormState {
  university_id: string;
  faculty_id: string;
  semester_number: string;
  subject_id: string;
  rate_per_session: string;
  years_of_experience: string;
}

export default function SubjectForm() {
  const [formState, setFormState] = useState<SubjectFormState>({
    university_id: "",
    faculty_id: "",
    semester_number: "",
    subject_id: "",
    rate_per_session: "",
    years_of_experience: "0",
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
    queryKey: ["faculties", formState.university_id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/academic/universities/${formState.university_id}/faculties`
      );
      return data as Faculty[];
    },
    enabled: !!formState.university_id,
    staleTime: 1000 * 60 * 10,
  });

  // Step 3: Generate semester array from faculty.number_of_semesters
  const semesters = useMemo(() => {
    if (!formState.faculty_id || !facultiesQuery.data) return [];
    const faculty = facultiesQuery.data.find((f) => f.id === formState.faculty_id);
    if (!faculty) return [];
    return Array.from({ length: faculty.number_of_semesters }, (_, i) => (i + 1).toString());
  }, [formState.faculty_id, facultiesQuery.data]);

  // Step 4: Fetch subjects for selected faculty
  const facultySubjectsQuery = useQuery({
    queryKey: ["faculty-subjects", formState.university_id, formState.faculty_id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/subjects/universities/${formState.university_id}/faculties/${formState.faculty_id}/subjects`
      );
      return data as Subject[];
    },
    enabled: !!formState.university_id && !!formState.faculty_id,
    staleTime: 1000 * 60 * 10,
  });

  // Step 5: Filter subjects by semester_number
  const filteredSubjects = useMemo(() => {
    if (!facultySubjectsQuery.data || !formState.semester_number) return [];
    const semesterNum = parseInt(formState.semester_number, 10);
    return facultySubjectsQuery.data.filter(
      (subject) => subject.semester_number === semesterNum && subject.is_active
    );
  }, [facultySubjectsQuery.data, formState.semester_number]);

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
    if (name === "university_id") {
      setFormState((prev) => ({
        ...prev,
        university_id: value,
        faculty_id: "",
        semester_number: "",
        subject_id: "",
      }));
    } else if (name === "faculty_id") {
      setFormState((prev) => ({
        ...prev,
        faculty_id: value,
        semester_number: "",
        subject_id: "",
      }));
    } else if (name === "semester_number") {
      setFormState((prev) => ({
        ...prev,
        semester_number: value,
        subject_id: "",
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
    mutationFn: async (payload: { subject_id: string; rate_per_session: number; years_of_experience: number }) => {
      const { data } = await apiClient.post("/teachers/me/subjects", payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Subject added successfully");
      setFormState({
        university_id: "",
        faculty_id: "",
        semester_number: "",
        subject_id: "",
        rate_per_session: "",
        years_of_experience: "0",
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

    if (!formState.subject_id) {
      toast.error("Please select a subject");
      return;
    }

    if (!formState.rate_per_session) {
      toast.error("Please enter rate per session");
      return;
    }

    const rate = parseFloat(formState.rate_per_session);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }

    const experience = parseInt(formState.years_of_experience, 10);
    if (isNaN(experience) || experience < 0) {
      toast.error("Years of experience must be a non-negative number");
      return;
    }

    addSubjectMutation.mutate({
      subject_id: formState.subject_id,
      rate_per_session: rate,
      years_of_experience: experience,
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
              name="university_id"
              value={formState.university_id}
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
              name="faculty_id"
              value={formState.faculty_id}
              onChange={handleFormChange}
              disabled={!formState.university_id || facultiesQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.university_id
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
              name="semester_number"
              value={formState.semester_number}
              onChange={handleFormChange}
              disabled={!formState.faculty_id}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.faculty_id ? "Select Faculty first" : "Select Semester"}
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
              name="subject_id"
              value={formState.subject_id}
              onChange={handleFormChange}
              disabled={!formState.semester_number || facultySubjectsQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.semester_number
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
              name="rate_per_session"
              value={formState.rate_per_session}
              onChange={handleFormChange}
              placeholder="Enter rate"
              step="100"
              min="0"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          {/* Years of Experience */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Years of Experience</label>
            <input
              type="number"
              name="years_of_experience"
              value={formState.years_of_experience}
              onChange={handleFormChange}
              placeholder="0"
              min="0"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          {/* Add Button */}
          <button
            type="submit"
            disabled={addSubjectMutation.isPending || !formState.subject_id}
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
                key={ts.subject_id}
                className="flex items-center justify-between rounded-md border border-border bg-muted px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{ts.subject.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Rs. {ts.rate_per_session.toLocaleString()} per session • {ts.years_of_experience} years experience
                  </p>
                  {ts.subject.semester_number && (
                    <p className="text-xs text-muted-foreground">
                      Semester {ts.subject.semester_number}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteSubjectMutation.mutate(ts.subject_id)}
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
