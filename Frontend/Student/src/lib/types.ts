
/**
 * Academic Domain Hierarchy (4-Level)
 * StudyLevel -> Board -> Faculty -> Subject -> Unit Value
 */

export interface StudyLevel {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
}

export interface Board {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
  /** Only present when fetched with study-level context */
  studyLevels?: StudyLevel[] | null;
}

export interface Faculty {
  id: string;
  name: string;
  unitType: UnitType;
  totalUnits: number;
  board?: Board | null;
  studyLevel?: StudyLevel | null;
  description?: string | null;
  isActive?: boolean | null;
}

export interface Subject {
  id: string;
  name: string;
  unitValue: number;
  isActive?: boolean | null;
  faculty?: Faculty | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BoardStudyLevelAssociation {
  id: string;
  boardId: string;
  studyLevelId: string;
}

export enum UnitType {
  SEMESTER = 'SEMESTER',
  GRADE = 'GRADE',
  YEAR = 'YEAR',
}

// ─── User & Authentication ────────────────────────────────────────────────────

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DocumentType = 'NID_FRONT' | 'NID_BACK' | 'PAN_CARD' | 'SELFIE_WITH_NID';

// ─── Legacy Teacher (used by mock data in constants.ts, SearchTeacherCard, etc.) ─
/**
 * @deprecated Legacy Teacher type used only by mock data.
 * Use TeacherPublicProfile + TeacherSubjectRead for real API data.
 */
export interface Teacher {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  subject?: string;
  image?: string;
  rating?: number;
  popularity?: string;
  tagline?: string;
  ratePerSession?: number;
  levelExpertise?: string[];
  verificationStatus?: VerificationStatus;
  avgRating?: number;
  bio?: string;
  qualification?: string;
  yearsOfExperience?: number;
  totalReviews?: number;
  isAvailable?: boolean;
}

/**
 * Full authenticated user (from /auth/me or UserRead).
 * Matches backend UserRead schema (camelCase via SharedConfig).
 */
export interface User {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  /** Backend field: phone (not phoneNumber) */
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  isSuperuser: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal public user info embedded inside teacher profile responses.
 * Matches backend UserPublicRead schema.
 */
export interface UserPublicRead {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  avatarUrl?: string | null;
}

export interface StudentProfile {
  userId: string;
  bio?: string | null;
}

// ─── Teacher Public Profile ───────────────────────────────────────────────────

/**
 * Public teacher profile returned by GET /teachers/{id}/profile.
 * Matches backend TeacherProfileRead schema.
 */
export interface TeacherPublicProfile {
  userId: string;
  bio?: string | null;
  tagline?: string | null;
  totalExperienceMinutes: number;
  avgRating: number;
  ratingCount: number;
  user: UserPublicRead;
}

/**
 * Teacher's subject entry with rates & stats.
 * Matches backend TeacherSubjectRead schema.
 */
export interface TeacherSubjectRead {
  teacherId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  experienceMinutes: number;
  totalSessionsCompleted: number;
  avgRating: number;
  ratingCount: number;
  subject: Subject;
}

/**
 * A local UI model combining teacher + subject for SubjectCard / BookingModal.
 * NOTE: ratePerSession / avgRating are plain numbers here (Decimal is serialised to string by Pydantic,
 * but axios parses JSON numbers natively).
 */
export interface TeacherSubject {
  teacherId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  experienceMinutes: number;
  totalSessionsCompleted: number;
  avgRating: number;
  ratingCount: number;
  isActive: boolean;
  subject: Subject;
}

/**
 * Minimal teacher info embedded inside booking responses for students.
 * Matches backend TeacherInBooking schema.
 */
export interface TeacherInBooking {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string | null;
}

/**
 * Rating returned by GET /teachers/{id}/ratings and POST /ratings/
 * Matches backend RatingRead schema.
 */
export interface RatingStudent {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  avatarUrl?: string | null;
}

export interface TeacherRating {
  id: string;
  score: number;
  comment?: string | null;
  createdAt: string;
  student: RatingStudent;
  subject: { name: string };
}

/**
 * Rating included in a completed/cancelled booking response.
 * Populated once backend team adds it to BookingDetailedReadForStudent.
 */
export interface BookingRating {
  id: string;
  score: number;
  comment?: string | null;
  createdAt: string;
}

/**
 * Search result card returned by GET /teachers/search.
 * Matches backend TeacherSearchResult schema.
 */
export interface TeacherSearchResult {
  teacherId: string;
  subjectId: string;
  ratePerSession: number;
  yearsOfExperience: number;
  experienceMinutes: number;
  avgRating: number;
  ratingCount: number;
  totalSessionsCompleted: number;
  teacherName: string;
  teacherTagline?: string | null;
  teacherAvatarUrl?: string | null;
  subject: Subject;
}

// ─── Booking & Session ────────────────────────────────────────────────────────

export type BookingStatus =
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED_BY_STUDENT'
  | 'CANCELLED_BY_TEACHER';

export type SessionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'Live'
  | 'Scheduled'
  | 'Completed'
  | 'Active';

/**
 * Booking as returned by GET /bookings (BookingRead schema).
 */
export interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  subjectId: string;
  subject?: Subject | null;
  /** Embedded teacher details — available from BookingDetailedReadForStudent */
  teacher?: TeacherInBooking | null;
  /** Rating submitted for this booking — populated by backend once team implements it */
  rating?: BookingRating | null;
  status: BookingStatus;
  totalAmount: number;
  ratePerSession: number;
  sessionDurationMinutes: number;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  refundedAmount: number;
  teacherApprovedAt?: string | null;
  createdAt: string;
  // ── UI-only optional fields (used by StudentBookingCard display) ──
  /** Whether the student has already submitted a review for this booking */
  hasReview?: boolean;
  /** ISO timestamp of when the booking was cancelled */
  cancelledAt?: string | null;
  /** Reason provided for cancellation */
  cancellationReason?: string | null;
}

export interface Session {
  id: string;
  sessionNumber: number;
  status: SessionStatus;
  actualStartAt?: string;
  booking: {
    id: string;
    totalSessions: number;
    teacher: {
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

// ─── Payment & Financial ──────────────────────────────────────────────────────

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

// ─── Ratings ─────────────────────────────────────────────────────────────────

/**
 * Generic rating (used by student rating submission context).
 * For teacher profile page ratings, use TeacherRating instead.
 */
export interface Rating {
  id: string;
  teacherId: string;
  studentId: string;
  score: number;
  comment?: string | null;
  createdAt: string;
}

// ─── Communication ────────────────────────────────────────────────────────────

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

// ─── API Request Types ────────────────────────────────────────────────────────

/**
 * Request body for POST /bookings/request (BookingRequestCreate schema).
 */
export interface CreateBookingRequest {
  teacherId: string;
  subjectId: string;
  totalSessions: number;
  ratePerSession: number;
  sessionDurationMinutes: number;
}

/** @deprecated Use CreateBookingRequest instead */
export type BookTeacherRequest = CreateBookingRequest;

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
  phone?: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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

// ─── Pagination & Errors ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ErrorResponse {
  detail: string;
  statusCode: number;
  errorCode?: string;
}
