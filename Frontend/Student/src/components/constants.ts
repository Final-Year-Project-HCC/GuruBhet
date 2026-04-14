
import { Teacher, Session, StudyLevel } from '../lib/types';

export const COMPLETED_SESSIONS: any[] = [
  {
    id: 'c1',
    teacherName: 'James Wilson',
    subject: 'Quantum Mechanics Basics',
    StudyLevel: 'Bachelor',
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
    StudyLevel: '10',
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
    StudyLevel: 'Master',
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
    firstName: 'James Wilson',
    middleName: '',
    lastName: '',
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
    firstName: 'Amara Okafor',
    middleName: '',
    lastName: '',
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
    firstName: 'Liam Neeson',
    middleName: '',
    lastName: '',
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
    firstName: 'Sophia Chen',
    middleName: '',
    lastName: '',
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
    firstName: 'Emily Watts',
    middleName: '',
    lastName: '',
    subject: 'Computer Science',
    tagline: 'Ex-Google engineer teaching Python & Algorithms.',
    image: 'https://picsum.photos/seed/emily/400/400',
    ratePerSession: 1100,
    levelExpertise: ['Bachelor'],
    verificationStatus: 'APPROVED'
  },
];

export const LEVELS: { id: StudyLevel; title: string; count: string }[] = [
];
