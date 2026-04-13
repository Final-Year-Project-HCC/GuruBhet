
import { Teacher, Session, SubjectLevel } from '../lib/types';

export const ACTIVE_SESSIONS: Session[] = [
  {
    id: '1',
    teacherName: 'Sarah Jenkins',
    subject: 'Advanced Calculus',
    subjectLevel: 'Bachelor',
    status: 'Live',
    durationMinutes: 60,
    completedSessions: 8,
    totalSessions: 12,
    nextSessionTime: 'Starts in 15 mins'
  },
  {
    id: '2',
    teacherName: 'Dr. Marcus Thorne',
    subject: 'Organic Chemistry',
    subjectLevel: 'Bachelor',
    status: 'Scheduled',
    durationMinutes: 90,
    completedSessions: 3,
    totalSessions: 20,
    nextSessionTime: 'Tomorrow, 4:00 PM'
  },
  {
    id: '3',
    teacherName: 'Elena Rodriguez',
    subject: 'UI/UX Design',
    subjectLevel: 'Diploma',
    status: 'Active',
    durationMinutes: 45,
    completedSessions: 15,
    totalSessions: 15,
    nextSessionTime: 'Review Pending'
  },
  {
    id: '4',
    teacherName: 'Kevin Wang',
    subject: 'Data Structures',
    subjectLevel: 'Bachelor',
    status: 'Scheduled',
    durationMinutes: 60,
    completedSessions: 5,
    totalSessions: 10,
    nextSessionTime: 'Wednesday, 10:00 AM'
  },
];

export const COMPLETED_SESSIONS: Session[] = [
  {
    id: 'c1',
    teacherName: 'James Wilson',
    subject: 'Quantum Mechanics Basics',
    subjectLevel: 'Bachelor',
    status: 'Completed',
    durationMinutes: 60,
    completedSessions: 10,
    totalSessions: 10,
    completionDate: 'Oct 12, 2023',
    ratingGiven: 5
  },
  {
    id: 'c2',
    teacherName: 'Sophia Chen',
    subject: 'Intro to Mandarin',
    subjectLevel: '10',
    status: 'Completed',
    durationMinutes: 45,
    completedSessions: 5,
    totalSessions: 5,
    completionDate: 'Sept 28, 2023',
    ratingGiven: 4
  },
  {
    id: 'c3',
    teacherName: 'Dr. Arpan Sharma',
    subject: 'Statistical Physics',
    subjectLevel: 'Master',
    status: 'Completed',
    durationMinutes: 90,
    completedSessions: 12,
    totalSessions: 12,
    completionDate: 'Aug 15, 2023',
    ratingGiven: 5
  }
];


export const TRENDING_TEACHERS: Teacher[] = [
  {
    id: 't1',
    name: 'James Wilson',
    subject: 'Quantum Physics',
    image: 'https://picsum.photos/seed/james/400/400',
    rating: 4.9,
    popularity: 'Top Rated',
    ratePerSession: 1200,
    levelExpertise: ['Bachelor', 'Master'],
    verificationStatus: 'APPROVED'
  },
  {
    id: 't2',
    name: 'Amara Okafor',
    subject: 'Economics',
    image: 'https://picsum.photos/seed/amara/400/400',
    rating: 4.8,
    popularity: 'Rising Star',
    ratePerSession: 850,
    levelExpertise: ['11-12', 'Bachelor'],
    verificationStatus: 'APPROVED'
  },
  {
    id: 't3',
    name: 'Liam Neeson',
    subject: 'History of Art',
    image: 'https://picsum.photos/seed/liam/400/400',
    rating: 5.0,
    popularity: 'Bestseller',
    ratePerSession: 1500,
    levelExpertise: ['Bachelor', 'Master'],
    verificationStatus: 'APPROVED'
  },
  {
    id: 't4',
    name: 'Sophia Chen',
    subject: 'Mandarin',
    image: 'https://picsum.photos/seed/sophia/400/400',
    rating: 4.7,
    popularity: 'Trending',
    ratePerSession: 950,
    levelExpertise: ['10', '11-12', 'Diploma'],
    verificationStatus: 'APPROVED'
  },
];

export const RECOMMENDED_TEACHERS: Teacher[] = [
  {
    id: 'r1',
    name: 'Emily Watts',
    subject: 'Computer Science',
    tagline: 'Ex-Google engineer teaching Python & Algorithms.',
    image: 'https://picsum.photos/seed/emily/400/400',
    ratePerSession: 1100,
    levelExpertise: ['Bachelor'],
    verificationStatus: 'APPROVED'
  },
  {
    id: 'r2',
    name: 'David Kim',
    subject: 'Graphic Design',
    tagline: 'Master the Adobe Suite with a professional artist.',
    image: 'https://picsum.photos/seed/david/400/400',
    ratePerSession: 700,
    levelExpertise: ['Diploma'],
    verificationStatus: 'APPROVED'
  },
  {
    id: 'r3',
    name: 'Isabella Rossi',
    subject: 'Italian Language',
    tagline: 'Native speaker with 10 years of teaching experience.',
    image: 'https://picsum.photos/seed/isabella/400/400',
    ratePerSession: 900,
    levelExpertise: ['10', '11-12'],
    verificationStatus: 'APPROVED'
  },
  {
    id: 'r4',
    name: 'Dr. Arpan Sharma',
    subject: 'Applied Physics',
    tagline: 'Simplifying complex quantum mechanics for everyone.',
    image: 'https://picsum.photos/seed/arpan/400/400',
    ratePerSession: 1400,
    levelExpertise: ['Bachelor', 'Master'],
    verificationStatus: 'APPROVED'
  },
];

export const LEVELS: { id: SubjectLevel; title: string; count: string }[] = [
  { id: '10', title: 'Secondary (Grade 10)', count: '120+ Tutors' },
  { id: '11-12', title: 'Higher Secondary (11-12)', count: '240+ Tutors' },
  { id: 'Bachelor', title: 'Bachelor Level', count: '450+ Tutors' },
  { id: 'Master', title: 'Master Level', count: '180+ Tutors' },
  { id: 'Diploma', title: 'Diploma & Vocational', count: '90+ Tutors' },
];
