
import React from 'react';
import Image from 'next/image';
import { Teacher } from '../../lib/types';

interface SearchTeacherCardProps {
  teacher: Teacher;
  onClick: () => void;
  onMessage: (e: React.MouseEvent) => void;
}

const SearchTeacherCard: React.FC<SearchTeacherCardProps> = ({
  teacher,
  onClick,
  onMessage,
}) => {
  return (
    <div
      className="group bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col h-full cursor-pointer hover:-translate-y-2 duration-300"
      onClick={onClick}
    >
      {/* Top Media Section */}
      <div className="relative aspect-16/11 overflow-hidden">
        <Image
          src={teacher.image || '/avatar-placeholder.png'}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          alt={teacher.name}
        />

        {/* Verification Checkmark */}
        {teacher.verificationStatus === 'APPROVED' && (
          <div className="absolute top-5 left-5 bg-accent text-accent-foreground p-2 rounded-full shadow-lg border-2 border-background">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* Rating Overlay */}
        <div className="absolute top-5 right-5">
          <div className="bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-sm border border-background">
            <svg
              className="w-3.5 h-3.5 text-warning fill-current"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {teacher.rating || '5'}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-6 py-4 grow flex flex-col">
        <div className="mb-6">
          <h3 className="text-2xl font-black tracking-tight text-primary mb-1 truncate">
            {teacher.name}
          </h3>
          <p className="text-muted-foreground font-black text-[10px] uppercase tracking-widest">
            {teacher.subject}
          </p>
        </div>

        {/* Expertise Tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(teacher.levelExpertise || []).map((lvl) => (
            <span
              key={lvl}
              className="px-3 py-1.5 bg-subtle text-[10px] font-black text-subtle-foreground uppercase border border-border rounded-xl"
            >
              {lvl}
            </span>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-8 border-t border-subtle flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
              Starting at
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-primary">NPR</span>
              <span className="text-2xl font-black tracking-tighter text-primary">
                {teacher.ratePerSession}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMessage}
              className="p-3 border border-border rounded-2xl bg-subtle text-subtle-foreground hover:bg-muted hover:text-primary transition-all active:scale-95"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </button>
            <button
              onClick={onClick}
              className="bg-primary cursor-pointer text-primary-foreground px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg hover:bg-primary-hover hover:text-primary-hover-foreground active:scale-95 transition-all"
            >
              Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchTeacherCard;
