/* Student booking-related types */

// Teacher information for bookings
export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  avgRating?: number;
  profilePictureUrl?: string;
}

export interface Subject {
  id: string;
  name: string;
}

export type BookingStatus =
  | "PENDING_APPROVAL"
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export interface Booking {
  id: string;
  status: BookingStatus;
  studentId: string;
  teacher: Teacher;
  subject: Subject;
  startDate: string;
  createdAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  sessionDurationMinutes: number;
  totalAmount: number;
  ratePerSession: number;
  sessionType: string;
  totalSessions: number;
  completedSessions: number;
  hasReview: boolean;
}
