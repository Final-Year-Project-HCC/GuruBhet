
export type SubjectLevel = '10' | '11-12' | 'Bachelor' | 'Master' | 'Diploma';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Subject {
  id: string;
  name: string;
  level: SubjectLevel;
  board?: string;
  university?: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  image: string;
  rating?: number;
  popularity?: string;
  tagline?: string;
  rate_per_session: number;
  level_expertise: SubjectLevel[];
  verification_status: VerificationStatus;
}

export interface Session {
  id: string;
  teacherName: string;
  subject: string;
  subjectLevel: SubjectLevel;
  status: 'Scheduled' | 'Live' | 'Active' | 'Completed';
  duration_minutes: number;
  completed_sessions: number;
  total_sessions: number;
  next_session_time?: string;
  startTime?: string;
  completion_date?: string;
  rating_given?: number;
}
