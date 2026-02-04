
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
  status: 'Active' | 'Live';
  duration_minutes: number;
  startTime?: string;
}
