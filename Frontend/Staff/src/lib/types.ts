/**
 * Academic Domain Hierarchy
 * StudyLevel -> Board -> Faculty -> Subject
 */

export type UnitType = 'GRADE' | 'SEMESTER' | 'YEAR';

export interface StudyLevel {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  study_levels?: StudyLevel[];
  created_at?: string;
  updated_at?: string;
}

export interface Faculty {
  id: string;
  board_id: string;
  study_level_id: string;
  name: string;
  description?: string;
  unit_type: UnitType;
  total_units: number;
  is_active: boolean;
  board?: Board;
  study_level?: StudyLevel;
  created_at?: string;
  updated_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  study_level_id: string;
  board_id: string;
  faculty_id: string;
  unit_value: number;
  is_active: boolean;
  study_level?: StudyLevel;
  board?: Board;
  faculty?: Faculty;
  created_at?: string;
  updated_at?: string;
}

// Legacy types (kept for backward compatibility)
export interface University {
  id: string;
  name: string;
  description?: string;
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

/**
 * User & Authentication
 */

export type UserRole = 'ADMIN' | 'STAFF' | 'MODERATOR' | 'STUDENT' | 'TEACHER';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Permission = 
  | 'staff:manage' 
  | 'teacher:verify' 
  | 'teacher:view_sensitive'
  | 'academic_domains:manage';

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  is_email_verified: boolean;
  is_active: boolean;
  is_banned: boolean;
  is_superuser: boolean;
  mfa_enabled: boolean;
  permissions: Permission[];
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userType: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Teacher Management
 */

export type SubjectLevel = '10' | '11-12' | 'Bachelor' | 'Master' | 'Diploma';

export interface TeacherProfile {
  id: string;
  userId: string;
  bio?: string;
  qualification?: string;
  yearsOfExperience: number;
  profilePictureUrl?: string;
  verificationStatus: VerificationStatus;
  rating?: number;
  totalReviews?: number;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherSubject {
  id?: string;
  teacherId: string;
  subjectId: string;
  subject?: Subject;
  ratePerSession: number;
  yearsOfExperience: number;
  avgRating?: number;
  totalReviews?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Teacher {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  bio?: string;
  qualification?: string;
  yearsOfExperience: number;
  profilePictureUrl?: string;
  verificationStatus: VerificationStatus;
  rating?: number;
  totalReviews?: number;
  isAvailable: boolean;
  subjects?: TeacherSubject[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Student Management
 */

export interface StudentProfile {
  id: string;
  userId: string;
  educationalLevel?: SubjectLevel;
  profilePictureUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  educationalLevel?: SubjectLevel;
  profilePictureUrl?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Booking & Session Management
 */

export type BookingStatus =
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED_BY_STUDENT'
  | 'CANCELLED_BY_TEACHER';

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  student?: Student;
  subjectId: string;
  subject?: Subject;
  status: BookingStatus;
  totalAmount: number;
  ratePerSession: number;
  sessionDurationMinutes: number;
  totalSessions: number;
  completedSessions: number;
  createdAt: string;
  updatedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  nextSessionDate?: string;
}

export interface Session {
  id: string;
  bookingId: string;
  booking?: Booking;
  teacherId: string;
  studentId: string;
  student?: Student;
  subjectId: string;
  subject?: Subject;
  status: SessionStatus;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  notes?: string;
  livekitRoomName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payment & Financial
 */

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'ESEWA' | 'BANK_TRANSFER' | 'WALLET';

export interface Payment {
  id: string;
  bookingId: string;
  booking?: Booking;
  studentId: string;
  teacherId: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentAccount {
  id: string;
  teacherId: string;
  accountType: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankName?: string;
  esewaId?: string;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Payout {
  id: string;
  teacherId: string;
  amount: number;
  status: PaymentStatus;
  paymentAccountId: string;
  transactionId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Analytics & Dashboard
 */

export interface DashboardStats {
  totalTeachers: number;
  totalStudents: number;
  totalSessions: number;
  totalEarnings: number;
  pendingTeacherApprovals: number;
  activeBookings: number;
}

export interface TeacherStats {
  id: string;
  name: string;
  totalStudents: number;
  totalSessions: number;
  totalEarnings: number;
  averageRating: number;
  verificationStatus: VerificationStatus;
}

export interface StudentStats {
  id: string;
  name: string;
  totalBookings: number;
  completedSessions: number;
  averageTeacherRating: number;
}

export interface EarningsReport {
  totalEarnings: number;
  totalPayouts: number;
  pendingPayouts: number;
  monthlyEarnings: MonthlyEarning[];
}

export interface MonthlyEarning {
  month: string;
  amount: number;
  transactionCount: number;
}

/**
 * Rating & Review
 */

export interface Rating {
  id: string;
  bookingId: string;
  teacherId: string;
  studentId: string;
  student?: Student;
  ratingValue: number; // 1-5
  reviewText?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Communication
 */

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Audit & Logging
 */

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, string | number | boolean | null | undefined>;
  ipAddress?: string;
  createdAt?: string;
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

export interface CreateSubjectRequest {
  universityId: string;
  facultyId: string;
  semesterNumber: number;
  className?: string;
  name: string;
  description?: string;
}

export interface CreateTeacherRequest {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  qualification?: string;
  yearsOfExperience: number;
}

export interface UpdateTeacherRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  qualification?: string;
  yearsOfExperience?: number;
  isAvailable?: boolean;
}

export interface ApproveTeacherRequest {
  teacherId: string;
}

export interface RejectTeacherRequest {
  teacherId: string;
  reason: string;
}

export interface CreatePayoutRequest {
  teacherId: string;
  amount: number;
  paymentAccountId: string;
  notes?: string;
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

/**
 * Pagination & List Response
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Error Response
 */

export interface ErrorResponse {
  detail: string;
  statusCode: number;
  errorCode?: string;
}
