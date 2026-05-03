'use client';

import React from 'react';
import Image from 'next/image';
import { TeacherSearchResult } from '../../lib/types';

interface TeacherResultCardProps {
  teacher: TeacherSearchResult;
  onViewProfile: (teacherId: string) => void;
}

const StarRating: React.FC<{ rating: number; count: number }> = ({ rating, count }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <svg key={`full-${i}`} className="w-3.5 h-3.5 text-warning fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        {hasHalf && (
          <svg className="w-3.5 h-3.5 text-warning" viewBox="0 0 20 20">
            <defs>
              <linearGradient id="half-fill">
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path fill="url(#half-fill)" stroke="currentColor" strokeWidth="0.5" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <svg key={`empty-${i}`} className="w-3.5 h-3.5 text-muted-foreground/30" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-xs font-bold text-foreground">{rating?.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
};

const TeacherResultCard: React.FC<TeacherResultCardProps> = ({ teacher, onViewProfile }) => {
  const initials = teacher.teacherName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const subjectContext = [
    teacher.subject.faculty?.studyLevel?.name,
    teacher.subject.faculty?.board?.name,
    teacher.subject.faculty?.name,
  ].filter(Boolean);

  const unitContext = teacher.subject.faculty?.unitType
    ? `${teacher.subject.faculty.unitType} ${teacher.subject.unitValue}`
    : null;

  return (
    <div
      className="group bg-surface border border-border rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 duration-300 flex flex-col h-full cursor-pointer"
      onClick={() => onViewProfile(teacher.teacherId)}
    >
      {/* Top strip — subject name */}
      <div className="bg-muted/40 border-b border-border px-6 py-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">
          {teacher.subject.name}
        </p>
        {unitContext && (
          <span className="shrink-0 bg-border text-foreground text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">
            {unitContext}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4 grow">
        {/* Avatar + Name */}
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {teacher.teacherAvatarUrl ? (
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-border">
                <Image
                  src={teacher.teacherAvatarUrl}
                  alt={teacher.teacherName}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center text-lg font-black text-muted-foreground">
                {initials}
              </div>
            )}
            {/* Verified badge */}
            <div className="absolute -bottom-1 -right-1 bg-accent text-accent-foreground w-5 h-5 rounded-full flex items-center justify-center border-2 border-surface">
              <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
              {teacher.teacherName}
            </h3>
            {teacher.teacherTagline && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {teacher.teacherTagline}
              </p>
            )}
          </div>
        </div>

        {/* Rating */}
        <StarRating rating={Number(teacher.avgRating)} count={Number(teacher.ratingCount)} />

        {/* Context breadcrumbs */}
        {subjectContext.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {subjectContext.map((badge, idx) => (
              <span
                key={idx}
                className="text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50 border border-border px-2 py-1 rounded-lg"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">{teacher.yearsOfExperience} yr{teacher.yearsOfExperience !== 1 ? 's' : ''} exp.</span>
          </div>
          {teacher.experienceMinutes >= 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-semibold">
                {(() => { const h = Math.floor(teacher.experienceMinutes / 60); return h === 0 ? '0 hrs' : `${h}+ hrs`; })()} on platform
              </span>
            </div>
          )}
          {teacher.totalSessionsCompleted >= 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{teacher.totalSessionsCompleted} sessions</span>
            </div>
          )}
        </div>

        {/* Footer — price + CTA */}
        <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">
              Per Session
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-primary">NPR</span>
              <span className="text-2xl font-black tracking-tighter text-primary">
                {teacher.ratePerSession.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile(teacher.teacherId);
            }}
            className="bg-primary text-primary-foreground px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-md"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherResultCard;
