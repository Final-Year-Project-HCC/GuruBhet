"use client"
import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useTeacherForPublic, useTeacherSubjects, useTeacherRatings } from '@/hooks/useTeacherProfile';
import { useUser } from '@/hooks';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TeacherSubject } from '@/lib/types';
import SubjectCard from '@/components/SubjectCard';

const formatExperienceHours = (minutes: number): string => {
  if (minutes <= 0) return '0h';
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
};

const TeacherDetailPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: user } = useUser();
  const { data: teacherData } = useTeacherForPublic(user?.id || null);
  const { data: teacherSubjects } = useTeacherSubjects(user?.id || null);
  const { data: rawRatings, isLoading: ratingsLoading } = useTeacherRatings(user?.id || null);
  const ratings = rawRatings ?? [];

  const totalSessions = useMemo(
    () => (teacherSubjects ?? []).reduce((acc: number, s: TeacherSubject) => acc + s.totalSessionsCompleted, 0),
    [teacherSubjects]
  );

  if (!teacherData) {
    return (
      <LoadingSpinner />
    );
  }

  const fullName = [teacherData.user.firstName, teacherData.user.middleName, teacherData.user.lastName]
    .filter(Boolean)
    .join(' ');

  const initials = [teacherData.user.firstName, teacherData.user.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join('')
    .toUpperCase();

  return (
    <>
      <div className="bg-background min-h-screen py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
            {/* Left Column: Bio Card */}
            <div className="lg:col-span-1">
              <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-xl sticky top-8">
                <div className="aspect-square relative overflow-hidden bg-muted">
                  {teacherData.user.avatarUrl ? (
                    <Image
                      src={teacherData.user.avatarUrl}
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
                  {teacherData.tagline && (
                    <p className="text-sm text-muted-foreground mb-6 italic">{teacherData.tagline}</p>
                  )}
                  {!teacherData.tagline && <div className="mb-6" />}

                  {/* Stats */}
                  <div className="space-y-4 mb-6 pb-6 border-b border-border/50">
                    {teacherData.avgRating >= 0 && (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-3xl font-black tracking-tighter">{Number(teacherData.avgRating).toFixed(1)}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-foreground" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm text-muted-foreground">({teacherData.ratingCount || 0})</span>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Average Rating</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black tracking-tighter">{totalSessions}+</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sessions</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black tracking-tighter">{formatExperienceHours(teacherData.totalExperienceMinutes)}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Experience</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Content Area */}
            <div className="lg:col-span-3 space-y-12">
              {/* About Section */}
              {(teacherData.bio || teacherData.tagline) && (
                <section>
                  <h2 className="text-3xl font-black tracking-tight mb-6">About Me</h2>
                  <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed">
                    <p>{teacherData.bio || teacherData.tagline}</p>
                  </div>
                </section>
              )}

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
                {teacherSubjects && teacherSubjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {teacherSubjects.map((ts) => (
                      <SubjectCard
                        key={ts.subject.id}
                        teacherSubject={ts}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-muted-foreground font-semibold mb-1">No subjects found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search query</p>
                  </div>
                )}
              </section>

              {/* Student Feedback Section */}
              <section>
                <h2 className="text-xl font-black mb-6 uppercase tracking-widest text-muted-foreground">Student Feedback</h2>

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
                              {[r.student.firstName, r.student.lastName].filter(Boolean).join(' ')}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {r.subject.name} &bull; {new Date(r.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <svg key={i} xmlns="http://www.w3.org/2000/svg"
                                className={`h-3.5 w-3.5 ${i < r.score ? 'text-foreground fill-current' : 'text-muted-foreground/30 fill-current'}`}
                                viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        {r.comment && (
                          <p className="text-muted-foreground text-sm italic leading-relaxed">
                            &quot;{r.comment}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!ratingsLoading && ratings.length === 0 && (
                  <div className="bg-surface border border-border rounded-3xl p-8 text-center text-muted-foreground">
                    <p className="font-semibold">No reviews yet</p>
                    <p className="text-xs mt-1">Reviews from students will appear here once submitted.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TeacherDetailPage;
