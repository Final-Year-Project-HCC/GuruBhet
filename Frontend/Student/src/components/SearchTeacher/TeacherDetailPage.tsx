'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { TeacherSubject } from '../../lib/types';
import SubjectCard from './SubjectCard';
import BookingModal from './BookingModal';
import {
  useTeacherPublicProfile,
  useTeacherPublicSubjects,
  useTeacherRatings,
  useCreateBooking,
  adaptToTeacherSubject,
} from '@/hooks/useTeacherProfile';
import { toast } from 'react-toastify';

interface TeacherDetailPageProps {
  teacherId: string;
  onBack: () => void;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

const ProfileSkeleton: React.FC = () => (
  <div className="bg-background min-h-screen py-12 md:py-20 animate-pulse">
    <div className="max-w-7xl mx-auto px-4">
      <div className="h-5 w-28 bg-muted rounded mb-12" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
        {/* Left skeleton */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-xl">
            <div className="aspect-square bg-muted" />
            <div className="p-8 space-y-4">
              <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="h-10 bg-muted rounded" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Right skeleton */}
        <div className="lg:col-span-3 space-y-12">
          <div className="space-y-3">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Star Rating ─────────────────────────────────────────────────────────────

const StarRow: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <svg
        key={i}
        xmlns="http://www.w3.org/2000/svg"
        className={`h-3.5 w-3.5 ${i < score ? 'text-warning' : 'text-muted-foreground/30'}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const TeacherDetailPage: React.FC<TeacherDetailPageProps> = ({ teacherId, onBack }) => {
  const requireAuth = useRequireAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherSubject, setSelectedTeacherSubject] = useState<TeacherSubject | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ── API Calls ───────────────────────────────────────────────────────────────

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useTeacherPublicProfile(teacherId);

  const { data: rawSubjects = [], isLoading: subjectsLoading } =
    useTeacherPublicSubjects(teacherId);

  const { data: ratings = [], isLoading: ratingsLoading } =
    useTeacherRatings(teacherId);

  const createBookingMutation = useCreateBooking();

  // ── Adapters ────────────────────────────────────────────────────────────────

  // Convert API shape → local TeacherSubject shape expected by SubjectCard/BookingModal
  const teacherSubjects: TeacherSubject[] = useMemo(
    () => rawSubjects.map(adaptToTeacherSubject),
    [rawSubjects]
  );

  // Overall stats derived from subjects
  const avgRating = useMemo(() => {
    if (rawSubjects.length === 0) return 0;
    const rated = rawSubjects.filter((s) => s.ratingCount > 0);
    if (rated.length === 0) return 0;
    const total = rated.reduce((acc, s) => acc + s.avgRating * s.ratingCount, 0);
    const count = rated.reduce((acc, s) => acc + s.ratingCount, 0);
    return count > 0 ? total / count : 0;
  }, [rawSubjects]);

  const totalSessions = useMemo(
    () => rawSubjects.reduce((acc, s) => acc + s.totalSessionsCompleted, 0),
    [rawSubjects]
  );

  const maxExperience = useMemo(
    () => (rawSubjects.length > 0 ? Math.max(...rawSubjects.map((s) => s.yearsOfExperience)) : 0),
    [rawSubjects]
  );

  // Subject search filter
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return teacherSubjects;
    return teacherSubjects.filter((ts) =>
      ts.subject.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teacherSubjects, searchQuery]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleBookNow = (ts: TeacherSubject) => {
    setSelectedTeacherSubject(ts);
    setBookingError(null);
    setIsBookingModalOpen(true);
  };

  const handleConfirmBooking = async (
    ts: TeacherSubject,
    negotiatedRate: number,
    numberOfSessions: number,
    sessionDurationMinutes: number
  ) => {
    try {
      await createBookingMutation.mutateAsync({
        teacherId,
        subjectId: ts.subject.id,
        totalSessions: numberOfSessions,
        ratePerSession: negotiatedRate,
        sessionDurationMinutes,
      });
      toast.success('Booking request sent successfully!');
      setIsBookingModalOpen(false);
      setSelectedTeacherSubject(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to submit booking. Please try again.';
      setBookingError(msg);
    }
  };

  const handleCloseModal = () => {
    setIsBookingModalOpen(false);
    setSelectedTeacherSubject(null);
    setBookingError(null);
  };


  if (profileLoading) return <ProfileSkeleton />;

  if (profileError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Teacher not found</h1>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          This teacher's profile is unavailable. They may not be verified yet.
        </p>
        <button onClick={onBack} className="text-primary font-bold hover:underline text-sm">
          ← Go back to search
        </button>
      </div>
    );
  }

  const fullName = [profile.user.firstName, profile.user.middleName, profile.user.lastName]
    .filter(Boolean)
    .join(' ');

  const initials = [profile.user.firstName, profile.user.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join('')
    .toUpperCase();

  // ── Render ──────────────────────────────────────────────────────────────────

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

            {/* ── Left Column: Bio Card ───────────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-xl sticky top-8">

                {/* Avatar */}
                <div className="aspect-square relative overflow-hidden bg-muted">
                  {profile.user.avatarUrl ? (
                    <Image
                      src={profile.user.avatarUrl}
                      fill
                      sizes="(max-width: 1024px) 100vw, 25vw"
                      className="w-full h-full object-cover"
                      alt={fullName}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-black text-muted-foreground/40">
                      {initials}
                    </div>
                  )}
                  {/* Verified badge */}
                  <div className="absolute top-6 left-6">
                    <div className="bg-accent text-accent-foreground p-2 rounded-full shadow-lg border border-background/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="p-8 text-center">
                  <h1 className="text-3xl font-black tracking-tight mb-1">{fullName}</h1>
                  {profile.tagline && (
                    <p className="text-sm text-muted-foreground mb-6 italic">{profile.tagline}</p>
                  )}
                  {!profile.tagline && <div className="mb-6" />}

                  {/* Stats */}
                  <div className="space-y-4 mb-6 pb-6 border-b border-border/50">
                    {avgRating > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-3xl font-black tracking-tighter">{avgRating.toFixed(1)}</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Average Rating</span>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-4">
                      {totalSessions > 0 && (
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-black tracking-tighter">{totalSessions}+</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sessions</span>
                        </div>
                      )}
                      {maxExperience > 0 && (
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-black tracking-tighter">{maxExperience}+</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Years XP</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column: Content ───────────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-12">

              {/* About Section */}
              {profile.bio && (
                <section>
                  <h2 className="text-3xl font-black tracking-tight mb-6">About Me</h2>
                  <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed">
                    <p>{profile.bio}</p>
                  </div>
                </section>
              )}

              {/* Teaching Catalog */}
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                  <h2 className="text-2xl font-black tracking-tight">Teaching Catalog</h2>
                  {teacherSubjects.length > 3 && (
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
                  )}
                </div>

                {/* Loading */}
                {subjectsLoading && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-56 bg-muted animate-pulse rounded-3xl" />
                    ))}
                  </div>
                )}

                {/* Subject Cards */}
                {!subjectsLoading && filteredSubjects.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {filteredSubjects.map((ts) => (
                      <SubjectCard
                        key={ts.subject.id}
                        teacherSubject={ts}
                        onBookNow={handleBookNow}
                        requireAuth={requireAuth}
                      />
                    ))}
                  </div>
                )}

                {/* Empty */}
                {!subjectsLoading && filteredSubjects.length === 0 && (
                  <div className="bg-surface border border-border rounded-3xl p-12 text-center mb-8">
                    <svg className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-muted-foreground font-semibold mb-1">
                      {searchQuery ? 'No subjects matched your search' : 'No subjects available'}
                    </p>
                    {searchQuery && (
                      <p className="text-sm text-muted-foreground">Try a different keyword</p>
                    )}
                  </div>
                )}

                <div className="bg-muted/30 border border-border rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground">
                    💡 <span className="font-semibold">Pro Tip:</span> Each subject has its own rate and experience level. Select a subject above to book a session tailored to your specific academic needs.
                  </p>
                </div>
              </section>

              {/* Recent Reviews */}
              <section>
                <h2 className="text-xl font-black mb-6 uppercase tracking-widest text-muted-foreground">
                  Student Feedback
                </h2>

                {ratingsLoading && (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-28 bg-muted animate-pulse rounded-3xl" />
                    ))}
                  </div>
                )}

                {!ratingsLoading && ratings.length > 0 && (
                  <div className="space-y-4">
                    {ratings.map((r) => (
                      <div key={r.id} className="bg-surface border border-border rounded-3xl p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-foreground">
                              {r.isAnonymous ? 'Anonymous Student' : 'Verified Student'}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(r.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <StarRow score={r.score} />
                        </div>
                        {r.comment && (
                          <p className="text-muted-foreground text-sm italic leading-relaxed">
                            "{r.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!ratingsLoading && ratings.length === 0 && (
                  <div className="bg-surface border border-border rounded-3xl p-8 text-center text-muted-foreground">
                    <p className="font-semibold">No reviews yet</p>
                    <p className="text-xs mt-1">Be the first to book a session and leave a review!</p>
                  </div>
                )}
              </section>

            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {isBookingModalOpen && selectedTeacherSubject && (
        <BookingModal
          isOpen={isBookingModalOpen}
          teacherSubject={selectedTeacherSubject}
          teacherName={fullName}
          onClose={handleCloseModal}
          onConfirm={handleConfirmBooking}
          isLoading={createBookingMutation.isPending}
          serverError={bookingError}
        />
      )}
    </>
  );
};

export default TeacherDetailPage;
