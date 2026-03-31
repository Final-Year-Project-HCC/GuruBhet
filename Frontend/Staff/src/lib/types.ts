/**
 * Academic Domain Hierarchy
 * University -> Faculty -> Semester(s) -> Subject(s)
 */

export interface University {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  description?: string;
  numberOfSemesters: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Semester {
  id: string;
  universityId: string;
  facultyId: string;
  semesterNumber: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  universityId: string;
  facultyId: string;
  semesterId: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * API Request/Response types
 */
export interface CreateUniversityRequest {
  name: string;
  description?: string;
}

export interface CreateFacultyRequest {
  universityId: string;
  name: string;
  description?: string;
  numberOfSemesters: number;
}

export interface CreateSemesterRequest {
  universityId: string;
  facultyId: string;
  semesterNumber: number;
}

export interface CreateSubjectRequest {
  universityId: string;
  facultyId: string;
  semesterId: string;
  name: string;
  description?: string;
}

/**
 * Bulk operation types
 */
export interface BulkCreateSubjectRequest {
  subjects: CreateSubjectRequest[];
}

export interface BulkCreateFacultyRequest {
  faculties: CreateFacultyRequest[];
}
