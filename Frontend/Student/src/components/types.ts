
/**
 * Academic Domain Hierarchy (4-Level)
 * StudyLevel -> Board -> Faculty -> Subject -> Unit Value
 */

export interface StudyLevel {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardStudyLevelAssociation {
  id: string;
  boardId: string;
  studyLevelId: string;
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
  unitType: UnitType; // GRADE, SEMESTER, YEAR, etc.
  totalUnits: number;
  createdAt?: string;
  updatedAt?: string;
}

export enum UnitType {
  SEMESTER = 'SEMESTER',
  GRADE = 'GRADE',
  YEAR = 'YEAR',
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


export interface SubjectWithContext extends Subject {
  fullContext: string; // e.g., "Bachelor > Tribhuvan University > CSIT > Semester 5"
  contextDict: {
    studyLevel: string;
    board: string;
    faculty: string;
    unitValue: number;
    unitType: string;
    totalUnits: number;
  };
}

/**
 * User & Authentication
 */

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// For backward compatibility with components that reference SubjectLevel
export type SubjectLevel = string;

export interface Teacher {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  subject?: string;
  image?: string;
  rating?: number;
  popularity?: string;
  tagline?: string;
  ratePerSession?: number;
  levelExpertise?: string[];
  verificationStatus?: VerificationStatus;
  bio?: string;
  qualification?: string;
  yearsOfExperience?: number;
  totalReviews?: number;
  isAvailable?: boolean;
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

export interface StudentProfile {
  id: string;
  userId: string;
  educationalLevel?: string;
  profilePictureUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Teacher Information (for student discovery)
 */

export interface TeacherProfile {
  id: string;
  userId: string;
  bio?: string;
  qualification?: string;
  yearsOfExperience: number;
  profilePictureUrl?: string;
  verificationStatus: VerificationStatus;
  avgRating?: number;
  ratingCount?: number;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherSubjectRead {
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

export interface TeacherSearchResult {
  teacherId: string;
  subjectId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  avgRating: number;
  ratingCount: number;
  totalSessionsCompleted: number;
  teacherName: string;
  teacherHeadline?: string;
  teacherAvatarUrl?: string;
  subject: Subject;
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

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'Live' | 'Scheduled' | 'Completed' | 'Active';

export interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  teacher?: Teacher;
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
  bookingId?: string;
  booking?: Booking;
  teacherId?: string;
  studentId?: string;
  teacher?: Teacher;
  subjectId?: string;
  subject?: Subject | string; // Allow string for mock data
  status: SessionStatus;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  notes?: string;
  livekitRoomName?: string;
  createdAt?: string;
  updatedAt?: string;
  // UI/Display properties
  teacherName?: string;
  subjectLevel?: SubjectLevel;
  completedSessions?: number;
  totalSessions?: number;
  nextSessionTime?: string;
  startTime?: string;
  completionDate?: string;
  ratingGiven?: number;
}

export interface SessionWithTeacher extends Session {
  teacherName: string;
  subjectLevel: SubjectLevel;
  completedSessions: number;
  totalSessions: number;
  nextSessionTime?: string;
  startTime?: string;
  completionDate?: string;
  ratingGiven?: number;
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

/**
 * Rating & Review
 */

export interface Rating {
  id: string;
  bookingId: string;
  teacherId: string;
  studentId: string;
  teacher?: Teacher;
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
  sender?: User;
  recipient?: User;
  content: string;
  isRead: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Analytics & Dashboard
 */

export interface StudentDashboardStats {
  totalSessions: number;
  completedSessions: number;
  totalSpent: number;
  averageTeacherRating: number;
}

export interface StudentBookingInfo {
  id: string;
  subject: string;
  teacherName: string;
  totalSessions: number;
  completedSessions: number;
  status: BookingStatus;
}

/**
 * API Request/Response types
 */

export interface BookTeacherRequest {
  teacherId: string;
  subjectId: string;
  totalSessions: number;
  sessionDurationMinutes: number;
  ratePerSession: number;
}

export interface InitiatePaymentRequest {
  bookingId: string;
  paymentMethod: PaymentMethod;
}

export interface SubmitRatingRequest {
  bookingId: string;
  ratingValue: number;
  reviewText?: string;
}

export interface CancelBookingRequest {
  bookingId: string;
  reason?: string;
}

export interface UpdateStudentProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  educationalLevel?: SubjectLevel;
  profilePictureUrl?: string;
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
