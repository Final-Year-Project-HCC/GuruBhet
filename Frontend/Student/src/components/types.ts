
/**
 * Academic Domain Hierarchy (4-Level)
 * StudyLevel -> Board -> Faculty -> Subject -> Unit Value
 */

export interface StudyLevel {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BoardStudyLevelAssociation {
  id: string;
  board_id: string;
  study_level_id: string;
}

export interface Board {
  id: string;
  name: string;
  study_levels?: StudyLevel[];
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Faculty {
  id: string;
  name: string;
  board: Board;
  board_id: string;
  description?: string;
  unit_type: UnitType; // GRADE, SEMESTER, YEAR, etc.
  total_units: number;
  created_at?: string;
  updated_at?: string;
}

export enum UnitType {
  SEMESTER = 'SEMESTER',
  GRADE = 'GRADE',
  YEAR = 'YEAR',
  MONTH = 'MONTH',
}

export interface Subject {
  id: string;
  name: string;
  study_level: StudyLevel;
  study_level_id: string;
  board: Board;
  board_id: string;
  faculty: Faculty;
  faculty_id: string;
  unit_value: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubjectWithContext extends Subject {
  full_context: string; // e.g., "Bachelor > Tribhuvan University > CSIT > Semester 5"
  context_dict: {
    study_level: string;
    board: string;
    faculty: string;
    unit_value: number;
    unit_type: string;
    total_units: number;
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
  created_at?: string;
  updated_at?: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  educationalLevel?: string;
  profilePictureUrl?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Teacher Information (for student discovery)
 */

export interface TeacherProfile {
  id: string;
  userId: string;
  bio?: string;
  qualification?: string;
  years_of_experience: number;
  profile_picture_url?: string;
  verification_status: VerificationStatus;
  avg_rating?: number;
  rating_count?: number;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherSubjectRead {
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

export interface TeacherSearchResult {
  teacher_id: string;
  subject_id: string;
  rate_per_session: number;
  years_of_experience: number;
  avg_rating: number;
  rating_count: number;
  total_sessions_completed: number;
  teacher_name: string;
  teacher_headline?: string;
  teacher_avatar_url?: string;
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
