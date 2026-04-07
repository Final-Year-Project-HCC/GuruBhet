
import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { TRENDING_TEACHERS, RECOMMENDED_TEACHERS } from '../constants';
import { TeacherSubjectRead, UnitType } from '../types';
import SubjectCard from './SubjectCard';
import BookingModal from './BookingModal';

interface TeacherDetailPageProps {
  teacherId: string;
  onBack: () => void;
}

const TeacherDetailPage: React.FC<TeacherDetailPageProps> = ({ teacherId, onBack }) => {
  const requireAuth = useRequireAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherSubject, setSelectedTeacherSubject] = useState<TeacherSubjectRead | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allTeachers = [...TRENDING_TEACHERS, ...RECOMMENDED_TEACHERS];
  const teacher = allTeachers.find(t => t.id === teacherId);

  // Mock teacher subjects - in production, fetch from API
  // This simulates a teacher teaching multiple subjects with different rates
  const teacherSubjects: TeacherSubjectRead[] = useMemo(() => {
    const board = { id: 'b-1', name: 'Tribhuvan University', description: undefined, is_active: true };
    
    const subjects = [
      {
        teacher_id: teacher?.id || '',
        subject_id: 'subj-1',
        rate_per_session: 1200,
        years_of_experience: 5,
        total_sessions_completed: 150,
        avg_rating: 4.9,
        rating_count: 48,
        is_active: true,
        subject: {
          id: 'subj-1',
          name: 'Quantum Mechanics',
          study_level: { id: 'sl-1', name: 'Bachelor', description: undefined, is_active: true },
          study_level_id: 'sl-1',
          board,
          board_id: 'b-1',
          faculty: {
            id: 'fac-1',
            name: 'Physics',
            board,
            board_id: 'b-1',
            study_level_id: 'sl-1',
            description: 'Advanced Physics Track',
            unit_type: UnitType.SEMESTER,
            total_units: 8,
            is_active: true,
          },
          faculty_id: 'fac-1',
          unit_value: 5,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      {
        teacher_id: teacher?.id || '',
        subject_id: 'subj-2',
        rate_per_session: 950,
        years_of_experience: 4,
        total_sessions_completed: 120,
        avg_rating: 4.8,
        rating_count: 42,
        is_active: true,
        subject: {
          id: 'subj-2',
          name: 'Classical Mechanics',
          study_level: { id: 'sl-1', name: 'Bachelor', description: undefined, is_active: true },
          study_level_id: 'sl-1',
          board,
          board_id: 'b-1',
          faculty: {
            id: 'fac-1',
            name: 'Physics',
            board,
            board_id: 'b-1',
            study_level_id: 'sl-1',
            description: 'Advanced Physics Track',
            unit_type: UnitType.SEMESTER,
            total_units: 8,
            is_active: true,
          },
          faculty_id: 'fac-1',
          unit_value: 3,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      {
        teacher_id: teacher?.id || '',
        subject_id: 'subj-3',
        rate_per_session: 1100,
        years_of_experience: 6,
        total_sessions_completed: 200,
        avg_rating: 4.9,
        rating_count: 65,
        is_active: true,
        subject: {
          id: 'subj-3',
          name: 'Thermodynamics',
          study_level: { id: 'sl-1', name: 'Bachelor', description: undefined, is_active: true },
          study_level_id: 'sl-1',
          board,
          board_id: 'b-1',
          faculty: {
            id: 'fac-1',
            name: 'Physics',
            board,
            board_id: 'b-1',
            study_level_id: 'sl-1',
            description: 'Advanced Physics Track',
            unit_type: UnitType.SEMESTER,
            total_units: 8,
            is_active: true,
          },
          faculty_id: 'fac-1',
          unit_value: 4,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ];
    return subjects;
  }, [teacher?.id]);

  // Filter subjects based on search query
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return teacherSubjects;
    }
    return teacherSubjects.filter(ts =>
      ts.subject.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teacherSubjects, searchQuery]);

  if (!teacher) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <h1 className="text-2xl font-bold mb-4">Teacher not found</h1>
        <button onClick={onBack} className="text-primary font-bold hover:underline">Go back to search</button>
      </div>
    );
  }

  const handleBookNow = (teacherSubject: TeacherSubjectRead) => {
    setSelectedTeacherSubject(teacherSubject);
    setIsBookingModalOpen(true);
  };

  const handleConfirmBooking = async (
    teacherSubject: TeacherSubjectRead,
    numberOfSessions: number,
    totalAmount: number
  ) => {
    setIsSubmitting(true);
    try {
      // TODO: Call your booking API endpoint here
      // const response = await createBooking({
      //   teacher_id: teacher.id,
      //   subject_id: teacherSubject.subject.id,
      //   number_of_sessions: numberOfSessions,
      //   total_amount: totalAmount,
      // });

      // Mock success response
      console.log('Booking submitted:', {
        teacher: teacher.name,
        subject: teacherSubject.subject.name,
        sessions: numberOfSessions,
        amount: totalAmount,
      });

      // Close modal on success
      setIsBookingModalOpen(false);
      setSelectedTeacherSubject(null);
      setSearchQuery('');

      // Show success message (integrate with your toast/notification system)
      alert('Booking request submitted successfully!');
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-background min-h-screen py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-bold text-sm uppercase tracking-widest">Back to Search</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
            {/* Left Column: Bio Card (Simplified) */}
            <div className="lg:col-span-1">
              <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-xl sticky top-8">
                <div className="aspect-square relative overflow-hidden">
                  <Image
                    src={teacher.image || '/avatar-placeholder.png'}
                    fill
                    sizes="(max-width: 1024px) 100vw, 25vw"
                    className="w-full h-full object-cover"
                    alt={teacher.name}
                  />
                  <div className="absolute top-6 left-6">
                    {teacher.verificationStatus === 'APPROVED' && (
                      <div className="bg-accent text-accent-foreground p-2 rounded-full shadow-lg border border-background/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 text-center">
                  <h1 className="text-3xl font-black tracking-tight mb-1">{teacher.name}</h1>
                  <p className="text-sm text-muted-foreground mb-6 italic">{teacher.tagline || 'Experienced educator'}</p>

                  {/* Stats */}
                  <div className="space-y-4 mb-6 pb-6 border-b border-border/50">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-black tracking-tighter">{teacher.rating || '4.9'}</span>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Average Rating</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black tracking-tighter">150+</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Students</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black tracking-tighter">5+</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Years XP</span>
                      </div>
                    </div>
                  </div>

                  {/* Expertise Tags */}
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Teaches</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {(teacher.levelExpertise || []).slice(0, 3).map((level) => (
                        <span key={level} className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1.5 rounded-lg">
                          {level}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Content Area */}
            <div className="lg:col-span-3 space-y-12">
              {/* About Section */}
              <section>
                <h2 className="text-3xl font-black tracking-tight mb-6">About Me</h2>
                <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
                  <p>
                    {teacher.tagline || `Expert educator specializing in multiple subjects. Committed to providing personalized 1-to-1 learning experiences that help students achieve their full academic potential.`}
                  </p>
                  <p>
                    With over 5 years of experience in the educational sector, I have helped hundreds of students navigate complex curricula including SEE/SLC, A-Levels, and Bachelor-level courses. My teaching methodology focuses on conceptual clarity followed by intensive problem-solving sessions.
                  </p>
                </div>
              </section>

              {/* Teaching Catalog Section */}
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                  <h2 className="text-2xl font-black tracking-tight">Teaching Catalog</h2>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search subjects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-64 bg-surface border border-border rounded-2xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Subject Cards Grid */}
                {filteredSubjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {filteredSubjects.map((ts) => (
                      <SubjectCard
                        key={ts.subject_id}
                        teacherSubject={ts}
                        onBookNow={handleBookNow}
                        requireAuth={requireAuth}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface border border-border rounded-3xl p-12 text-center">
                    <svg
                      className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-muted-foreground font-semibold mb-1">No subjects found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search query</p>
                  </div>
                )}

                <div className="bg-muted/30 border border-border rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground">
                    💡 <span className="font-semibold">Pro Tip:</span> Each subject has its own rate and experience level. Select a subject above to book a session tailored to your specific academic needs.
                  </p>
                </div>
              </section>

              {/* Recent Reviews Section */}
              <section>
                <h2 className="text-xl font-black mb-6 uppercase tracking-widest text-muted-foreground">Student Feedback</h2>
                <div className="space-y-4">
                  {[
                    { name: "Anish K.", rating: 5, comment: "Excellent explanation of complex topics. Highly recommended!", subject: "Quantum Mechanics" },
                    { name: "Priya S.", rating: 4, comment: "Very patient and well-prepared for every session.", subject: "Classical Mechanics" }
                  ].map((review, i) => (
                    <div key={i} className="bg-surface border border-border rounded-3xl p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold">{review.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">Studied {review.subject}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {[...Array(review.rating)].map((_, j) => (
                            <svg key={j} xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-warning" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm italic">{review.comment}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        teacherSubject={selectedTeacherSubject}
        teacherName={teacher.name}
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedTeacherSubject(null);
        }}
        onConfirm={handleConfirmBooking}
        isLoading={isSubmitting}
      />
    </>
  );
};

export default TeacherDetailPage;
