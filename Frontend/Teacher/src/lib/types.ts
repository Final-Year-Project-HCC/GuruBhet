export interface CurrentUserData {
  id: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phone?: string;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  isSuperuser: boolean;
  mfaEnabled: boolean;
  permissions: string[];
}

export interface TeacherDocument {
  id: string; // UUID
  type: string; // DocumentType
  fileUrl: string;
  status: string; // VerificationStatus
  remarks?: string | null;
  createdAt: string; // ISO datetime string
}

export interface TeacherData {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  documents: TeacherDocument[];
  // Add more fields as needed based on API response
}
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
  semesterNumber: number;
  className?: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * New Academic Hierarchy (4-Level)
 * StudyLevel -> Board -> Faculty -> Subject
 * Used by /academics/* endpoints
 * Fields use camelCase (converted by middleware from backend snake_case)
 */

export enum UnitType {
  SEMESTER = 'SEMESTER',
  GRADE = 'GRADE',
  YEAR = 'YEAR',
}

export interface StudyLevel {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Board {
  id: string;
  name: string;
  studyLevels?: StudyLevel[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Faculty {
  id: string;
  name: string;
  board: Board;
  boardId: string;
  description?: string;
  unitType: UnitType;
  totalUnits: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  name: string;
  studyLevel: StudyLevel;
  board: Board;
  faculty: Faculty;
  unitValue: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherAcademicSubject {
  subjectId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  totalSessionsCompleted: number;
  avgRating: number;
  ratingCount: number;
  isActive: boolean;
  subject: Subject;
}

/**
 * Teacher Profile Response from /teachers/me
 * Backend returns camelCase via middleware from snake_case
 */
export interface TeacherProfileResponse {
  userId: string;
  bio?: string;
  avatarUrl?: string;
  headline?: string;
  verificationStatus: VerificationStatus;
}

/**
 * Teacher Profile & Authentication
 */

export type SubjectLevel = '10' | '11-12' | 'Bachelor' | 'Master' | 'Diploma';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userType: 'TEACHER' | 'STUDENT' | 'ADMIN';
  isActive: boolean;
  emailVerified: boolean;
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

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profilePictureUrl?: string;
  phoneNumber?: string;
}

export interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  student: Student;
  subjectId: string;
  subject: Subject;
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
  bookingId?: string;
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

export interface SessionNote {
  id: string;
  sessionId: string;
  teacherId: string;
  content: string;
  attachmentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payment & Financial
 */

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'ESEWA';

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

export interface Transaction {
  id: string;
  studentName: string;
  amount: number;
  date: string;
  status: PaymentStatus;
  sessionSubject: string;
  bookingId?: string;
}

/**
 * Analytics & Dashboard
 */

export interface DashboardStats {
  totalStudents: number;
  totalSessions: number;
  totalHoursTaught: number;
  averageRating: number;
  totalEarnings: number;
  pendingPayments: number;
}

export interface EarningsData {
  totalEarned: number;
  monthlyEarnings: MonthlyEarning[];
  recentTransactions: Transaction[];
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
 * Audit & Logging
 */

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes?: Record<string, any>;
  ipAddress?: string;
  createdAt?: string;
}

/**
 * API Request/Response Types
 */

export interface CreateTeacherSubjectRequest {
  subjectId: string;
  ratePerSession: number;
  yearsOfExperience: number;
}

export interface UpdateTeacherSubjectRequest {
  ratePerSession?: number;
  yearsOfExperience?: number;
  isActive?: boolean;
}

export interface ApproveBookingRequest {
  bookingId: string;
}

export interface DeclineBookingRequest {
  bookingId: string;
  reason?: string;
}

export interface InitiatePaymentRequest {
  bookingId: string;
}

export interface CreateSessionRequest {
  bookingId: string;
  scheduledAt: string;
}

export interface CreatePaymentAccountRequest {
  accountType: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankName?: string;
  esewaId?: string;
  isPrimary: boolean;
}

export interface SubmitRatingRequest {
  bookingId: string;
  ratingValue: number;
  reviewText?: string;
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
