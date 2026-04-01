"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface Subject {
  id: string;
  name: string;
  level: string;
  university?: string;
  faculty?: string;
  semester?: string;
  board?: string;
  class_name?: string;
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
  university: string;
  faculty: string;
  semester: string;
  subject: string;
  rate_per_session: string;
  years_of_experience: string;
}

export default function SubjectForm() {
  const [formState, setFormState] = useState<SubjectFormState>({
    university: "",
    faculty: "",
    semester: "",
    subject: "",
    rate_per_session: "",
    years_of_experience: "0",
  });

  // Fetch universities
  const universitiesQuery = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/subjects/filter/universities`);
      return data as string[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch faculties (only if university is selected)
  const facultiesQuery = useQuery({
    queryKey: ["faculties", formState.university],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/subjects/filter/faculties?university=${encodeURIComponent(formState.university)}`
      );
      return data as string[];
    },
    enabled: !!formState.university,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch semesters (only if university and faculty are selected)
  const semestersQuery = useQuery({
    queryKey: ["semesters", formState.university, formState.faculty],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/subjects/filter/semesters?university=${encodeURIComponent(formState.university)}&faculty=${encodeURIComponent(formState.faculty)}`
      );
      return data as string[];
    },
    enabled: !!formState.university && !!formState.faculty,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch subjects (only if university, faculty, and semester are selected)
  const subjectsQuery = useQuery({
    queryKey: ["subjects-filtered", formState.university, formState.faculty, formState.semester],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/subjects?university=${encodeURIComponent(formState.university)}&faculty=${encodeURIComponent(formState.faculty)}&semester=${encodeURIComponent(formState.semester)}&limit=100`
      );
      return data as Subject[];
    },
    enabled: !!formState.university && !!formState.faculty && !!formState.semester,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch teacher's existing subjects
  const teacherSubjectsQuery = useQuery({
    queryKey: ["teacher-subjects"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/teachers/me/subjects`);
      return data as TeacherSubject[];
    },
    staleTime: 1000 * 60 * 2,
  });

  function handleFormChange(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    const { name, value } = e.target;

    // Reset dependent fields when parent selection changes
    if (name === "university") {
      setFormState((prev) => ({
        ...prev,
        university: value,
        faculty: "",
        semester: "",
        subject: "",
      }));
    } else if (name === "faculty") {
      setFormState((prev) => ({
        ...prev,
        faculty: value,
        semester: "",
        subject: "",
      }));
    } else if (name === "semester") {
      setFormState((prev) => ({
        ...prev,
        semester: value,
        subject: "",
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
      const { data } = await axios.post(`${API_BASE}/teachers/me/subjects`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Subject added successfully");
      setFormState({
        university: "",
        faculty: "",
        semester: "",
        subject: "",
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
      await axios.delete(`${API_BASE}/teachers/me/subjects/${subjectId}`);
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

    if (!formState.subject) {
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
      subject_id: formState.subject,
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
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              University
            </label>
            <select
              name="university"
              value={formState.university}
              onChange={handleFormChange}
              disabled={universitiesQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {universitiesQuery.isLoading ? "Loading..." : "Select University"}
              </option>
              {universitiesQuery.data?.map((uni) => (
                <option key={uni} value={uni}>
                  {uni}
                </option>
              ))}
            </select>
          </div>

          {/* Faculty Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Faculty
            </label>
            <select
              name="faculty"
              value={formState.faculty}
              onChange={handleFormChange}
              disabled={!formState.university || facultiesQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.university
                  ? "Select University first"
                  : facultiesQuery.isLoading
                    ? "Loading..."
                    : "Select Faculty"}
              </option>
              {facultiesQuery.data?.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Semester
            </label>
            <select
              name="semester"
              value={formState.semester}
              onChange={handleFormChange}
              disabled={!formState.faculty || semestersQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.faculty
                  ? "Select Faculty first"
                  : semestersQuery.isLoading
                    ? "Loading..."
                    : "Select Semester"}
              </option>
              {semestersQuery.data?.map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Subject
            </label>
            <select
              name="subject"
              value={formState.subject}
              onChange={handleFormChange}
              disabled={!formState.semester || subjectsQuery.isLoading}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50"
            >
              <option value="">
                {!formState.semester
                  ? "Select Semester first"
                  : subjectsQuery.isLoading
                    ? "Loading..."
                    : "Select Subject"}
              </option>
              {subjectsQuery.data?.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rate per Session */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Rate per Session (NPR)
            </label>
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
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Years of Experience
            </label>
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
            disabled={addSubjectMutation.isPending || !formState.subject}
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
                    ₹{ts.rate_per_session.toLocaleString()} per session • {ts.years_of_experience} years experience
                  </p>
                  {ts.subject.university && (
                    <p className="text-xs text-muted-foreground">
                      {ts.subject.university} • {ts.subject.faculty} • Semester {ts.subject.semester}
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
