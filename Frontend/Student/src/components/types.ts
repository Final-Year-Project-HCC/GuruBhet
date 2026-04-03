
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
 * User & Authentication
 */

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SubjectLevel = '10' | '11-12' | 'Bachelor' | 'Master' | 'Diploma';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  user_type: UserRole;
  is_active: boolean;
  email_verified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  educational_level?: SubjectLevel;
  profile_picture_url?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Teacher Information (for student discovery)
 */

export interface TeacherProfile {
  id: string;
  user_id: string;
  bio?: string;
  qualification?: string;
  years_of_experience: number;
  profile_picture_url?: string;
  verification_status: VerificationStatus;
  rating?: number;
  total_reviews?: number;
  is_available: boolean;
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
  name: string;
  email: string;
  phone_number?: string;
  subject: string;
  image: string;
  rating?: number;
  popularity?: string;
  tagline?: string;
  rate_per_session: number;
  level_expertise: SubjectLevel[];
  verification_status: VerificationStatus;
  bio?: string;
  qualification?: string;
  years_of_experience: number;
  total_reviews?: number;
  is_available?: boolean;
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
  teacher_id: string;
  student_id: string;
  teacher?: Teacher;
  subject_id: string;
  subject?: Subject;
  status: BookingStatus;
  total_amount: number;
  rate_per_session: number;
  session_duration_minutes: number;
  total_sessions: number;
  completed_sessions: number;
  created_at: string;
  updated_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  next_session_date?: string;
}

export interface Session {
  id: string;
  booking_id: string;
  booking?: Booking;
  teacher_id: string;
  student_id: string;
  teacher?: Teacher;
  subject_id: string;
  subject?: Subject;
  status: SessionStatus;
  scheduled_at: string;
  started_at?: string;
  ended_at?: string;
  duration_minutes: number;
  notes?: string;
  livekit_room_name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionWithTeacher extends Session {
  teacherName: string;
  subjectLevel: SubjectLevel;
  completed_sessions: number;
  total_sessions: number;
  next_session_time?: string;
  startTime?: string;
  completion_date?: string;
  rating_given?: number;
}

/**
 * Payment & Financial
 */

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'ESEWA' | 'BANK_TRANSFER' | 'WALLET';

export interface Payment {
  id: string;
  booking_id: string;
  booking?: Booking;
  student_id: string;
  teacher_id: string;
  amount: number;
  status: PaymentStatus;
  payment_method: PaymentMethod;
  transaction_id?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Rating & Review
 */

export interface Rating {
  id: string;
  booking_id: string;
  teacher_id: string;
  student_id: string;
  teacher?: Teacher;
  rating_value: number; // 1-5
  review_text?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Communication
 */

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender?: User;
  recipient?: User;
  content: string;
  is_read: boolean;
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
  teacher_id: string;
  subject_id: string;
  total_sessions: number;
  session_duration_minutes: number;
  rate_per_session: number;
}

export interface InitiatePaymentRequest {
  booking_id: string;
  payment_method: PaymentMethod;
}

export interface SubmitRatingRequest {
  booking_id: string;
  rating_value: number;
  review_text?: string;
}

export interface CancelBookingRequest {
  booking_id: string;
  reason?: string;
}

export interface UpdateStudentProfileRequest {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  educational_level?: SubjectLevel;
  profile_picture_url?: string;
}

/**
 * Pagination & List Response
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Error Response
 */

export interface ErrorResponse {
  detail: string;
  status_code: number;
  error_code?: string;
}
