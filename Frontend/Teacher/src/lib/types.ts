export interface CurrentUserData {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  isSuperuser: boolean;
  createdAt: string;
  avatarUrl: string | null;
  permissions: string[];
}

export interface TeacherDocument {
  id: string; // UUID
  type: string; // DocumentType
  fileUrl: string;
  status: string; // VerificationStatus
  remarks?: string | null;
  createdAt: string;
}

export interface TeacherPublicData {
  userId: string;
  bio?: string;
  tagline?: string;
  user: {
    firstName: string;
    middleName: string;
    lastName: string;
    avatarUrl: string;
  };
}

export interface TeacherData extends Omit<TeacherPublicData, 'user'> {
  user: CurrentUserData;
  documents: TeacherDocument[];
  documentStatus: VerificationStatus;
}
export enum UnitType {
  SEMESTER = "SEMESTER",
  GRADE = "GRADE",
  YEAR = "YEAR",
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
  unitType: UnitType;
  totalUnits: number;
  board?: Board;
  studyLevel?: StudyLevel;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  name: string;
  unitValue: number;
  faculty?: Faculty;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Teacher Profile Response from /teachers/me
 * Backend returns camelCase via middleware from snake_case
 */
export interface TeacherProfileResponse {
  userId: string;
  bio?: string;
  avatarUrl?: string;
  tagline?: string;
  verificationStatus: VerificationStatus;
}

/**
 * Teacher Profile & Authentication
 */

export type SubjectLevel = "10" | "11-12" | "Bachelor" | "Master" | "Diploma";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

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
  teacherId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  totalSessionsCompleted: number;
  avgRating: number;
  ratingCount: number;
  isActive: boolean;
  subject: Subject;
}
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userType: "TEACHER" | "STUDENT" | "ADMIN";
  isActive: boolean;
  emailVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Booking & Session Management
 */

export type BookingStatus =
  | "PENDING_APPROVAL"
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED_BY_STUDENT"
  | "CANCELLED_BY_TEACHER";

export type SessionStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

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
  sessionNumber: number;
  status: SessionStatus;
  actualStartAt?: string;
  booking: {
    id: string;
    totalSessions: number;
    student: {
      id: string;
      firstName: string;
      middleName?: string | null;
      lastName: string;
      avatarUrl?: string | null;
    }
    subject: {
      id: string;
      name: string;
    }
  }
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

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type PaymentMethod = "ESEWA";

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

export interface TeacherRating {
  id: string;
  sessionId: string;
  teacherId: string;
  subjectId: string;
  score: number;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
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
