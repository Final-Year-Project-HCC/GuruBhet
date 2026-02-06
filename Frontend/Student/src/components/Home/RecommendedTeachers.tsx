"use client";
import React from 'react';
import Carousel from './Carousel';
import { RECOMMENDED_TEACHERS } from '../constants';
import Link from 'next/link';

const RecommendedTeachers: React.FC = () => {
 
  return (
    <section className="py-12 bg-white border-t border-border">
      <Carousel 
        title="Recommended for You" 
       subtitle="These expert tutors have been matched to your learning profile."

      >
        {RECOMMENDED_TEACHERS.map((teacher, index) => (
          <div 
            key={teacher.id} 
            className="min-w-[280px] sm:min-w-[320px] group relative bg-white border border-border rounded-[1.5rem] overflow-hidden scroll-snap-align-start hover:shadow-xl hover:border-primary/20 transition-all duration-500 cursor-pointer flex flex-col"
          >
            {/* Top Badge Section - Scaled down */}
            {/* <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
              <div className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1 tracking-wider">
                <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                {index === 0 ? "TOP MATCH" : "98% MATCH"}
              </div>
            </div> */}

            <div className="p-5 flex-grow">
              {/* Header: Image & Basic Info - Optimized for smaller width */}
              <div className="flex gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <img 
                    src={teacher.image} 
                    className="relative w-16 h-16 rounded-xl object-cover border border-border shadow-sm group-hover:scale-105 transition-transform duration-500"
                    alt={teacher.name}
                  />
                  {teacher.verification_status === 'APPROVED' && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-0.5 rounded-full border border-white shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center min-w-0">
                  <h3 className="font-bold text-lg tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                    {teacher.name}
                  </h3>
                  <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest truncate">
                    {teacher.subject}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md">
                      <svg className="w-2.5 h-2.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-[10px] font-black">4.9</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tagline / Bio - Scaled down font */}
              <div className="mb-4">
                <p className="text-xs text-foreground/80 leading-snug line-clamp-2 font-medium bg-muted/30 p-3 rounded-xl border border-border/50 italic">
                  {teacher.tagline}
                </p>
              </div>

              {/* Levels - Minimal Pills */}
              <div className="flex flex-wrap gap-1.5">
                {teacher.level_expertise.map((lvl) => (
                  <span key={lvl} className="px-2 py-1 bg-white border border-border text-[9px] font-bold text-muted-foreground uppercase rounded-lg tracking-tight">
                    {lvl}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Section - Compact CTA and Price */}
            <div className="bg-muted/40 p-5 border-t border-border flex items-center justify-between mt-auto">
              <div className="flex flex-col">
                <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mb-0.5">Hourly Rate</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[10px] font-bold text-primary">NPR</span>
                  <span className="text-lg font-black text-primary tracking-tighter">{teacher.rate_per_session}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 items-end">
                <Link href={`/teacher-detail/${teacher.id}`}>
                <button  className="bg-primary cursor-pointer text-primary-foreground px-4 py-2 rounded-xl font-bold text-[11px] hover:bg-destructive transition-all shadow-md active:scale-95 flex items-center gap-1.5">
                  <span>View Profile</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </section>
  );
};

export default RecommendedTeachers;
