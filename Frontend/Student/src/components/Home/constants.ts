
import { Teacher, Session, SubjectLevel } from './types';

export const ACTIVE_SESSIONS: Session[] = [
  { id: '1', teacherName: 'Sarah Jenkins', subject: 'Advanced Calculus', subjectLevel: 'Bachelor', status: 'Live', duration_minutes: 60 },
  { id: '2', teacherName: 'Dr. Marcus Thorne', subject: 'Organic Chemistry', subjectLevel: 'Bachelor', status: 'Active', duration_minutes: 90 },
  { id: '3', teacherName: 'Elena Rodriguez', subject: 'UI/UX Design', subjectLevel: 'Diploma', status: 'Live', duration_minutes: 45 },
  { id: '4', teacherName: 'Kevin Wang', subject: 'Data Structures', subjectLevel: 'Bachelor', status: 'Active', duration_minutes: 60 },
  { id: '5', teacherName: 'Chloe Baker', subject: 'English Literature', subjectLevel: '11-12', status: 'Live', duration_minutes: 60 },
];

export const TRENDING_TEACHERS: Teacher[] = [
  { 
    id: 't1', 
    name: 'James Wilson', 
    subject: 'Quantum Physics', 
    image: 'https://picsum.photos/seed/james/400/400', 
    rating: 4.9, 
    popularity: 'Top Rated', 
    rate_per_session: 1200, 
    level_expertise: ['Bachelor', 'Master'],
    verification_status: 'APPROVED'
  },
  { 
    id: 't2', 
    name: 'Amara Okafor', 
    subject: 'Economics', 
    image: 'https://picsum.photos/seed/amara/400/400', 
    rating: 4.8, 
    popularity: 'Rising Star', 
    rate_per_session: 850, 
    level_expertise: ['11-12', 'Bachelor'],
    verification_status: 'APPROVED'
  },
  { 
    id: 't3', 
    name: 'Liam Neeson', 
    subject: 'History of Art', 
    image: 'https://picsum.photos/seed/liam/400/400', 
    rating: 5.0, 
    popularity: 'Bestseller', 
    rate_per_session: 1500, 
    level_expertise: ['Bachelor', 'Master'],
    verification_status: 'APPROVED'
  },
  { 
    id: 't4', 
    name: 'Sophia Chen', 
    subject: 'Mandarin', 
    image: 'https://picsum.photos/seed/sophia/400/400', 
    rating: 4.7, 
    popularity: 'Trending', 
    rate_per_session: 950, 
    level_expertise: ['10', '11-12', 'Diploma'],
    verification_status: 'APPROVED'
  },
];

export const RECOMMENDED_TEACHERS: Teacher[] = [
  { 
    id: 'r1', 
    name: 'Emily Watts', 
    subject: 'Computer Science', 
    tagline: 'Ex-Google engineer teaching Python & Algorithms.', 
    image: 'https://picsum.photos/seed/emily/400/400',
    rate_per_session: 1100,
    level_expertise: ['Bachelor'],
    verification_status: 'APPROVED'
  },
  { 
    id: 'r2', 
    name: 'David Kim', 
    subject: 'Graphic Design', 
    tagline: 'Master the Adobe Suite with a professional artist.', 
    image: 'https://picsum.photos/seed/david/400/400',
    rate_per_session: 700,
    level_expertise: ['Diploma'],
    verification_status: 'APPROVED'
  },
  { 
    id: 'r3', 
    name: 'Isabella Rossi', 
    subject: 'Italian Language', 
    tagline: 'Native speaker with 10 years of teaching experience.', 
    image: 'https://picsum.photos/seed/isabella/400/400',
    rate_per_session: 900,
    level_expertise: ['10', '11-12'],
    verification_status: 'APPROVED'
  },
  { 
    id: 'r4', 
    name: 'Dr. Arpan Sharma', 
    subject: 'Applied Physics', 
    tagline: 'Simplifying complex quantum mechanics for everyone.', 
    image: 'https://picsum.photos/seed/arpan/400/400',
    rate_per_session: 1400,
    level_expertise: ['Bachelor', 'Master'],
    verification_status: 'APPROVED'
  },
];

export const LEVELS: { id: SubjectLevel; title: string; count: string }[] = [
  { id: '10', title: 'Secondary (Grade 10)', count: '120+ Tutors' },
  { id: '11-12', title: 'Higher Secondary (11-12)', count: '240+ Tutors' },
  { id: 'Bachelor', title: 'Bachelor Level', count: '450+ Tutors' },
  { id: 'Master', title: 'Master Level', count: '180+ Tutors' },
  { id: 'Diploma', title: 'Diploma & Vocational', count: '90+ Tutors' },
];
