"use client";
import React from 'react';
import Carousel from './Carousel';
import { TRENDING_TEACHERS } from '../constants';

const TrendingSessions: React.FC = () => {
  return (
    <Carousel 
      title="Top Rated Tutors" 
      subtitle="Verified educators with the highest student satisfaction."
    >
      {TRENDING_TEACHERS.map((teacher) => (
        <div 
          key={teacher.id} 
          className="min-w-65 sm:min-w-70 group cursor-pointer scroll-snap-align-start bg-surface border border-border rounded-2xl p-4 hover:shadow-lg transition-all"
        >
          {/* Smaller, landscape-oriented image focus */}
          <div className="relative aspect-16/10 rounded-xl overflow-hidden mb-4 shadow-sm">
            <img 
              src={teacher.image} 
              alt={teacher.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-2 right-2">
              <div className="bg-surface/95 backdrop-blur px-2 py-1 rounded-lg shadow-sm border border-border flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-warning" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-bold">{teacher.rating}</span>
              </div>
            </div>
          </div>

          {/* Data-focused content */}
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors truncate">
                  {teacher.name}
                </h3>
                <p className="text-sm font-semibold text-primary/70">{teacher.subject}</p>
              </div>
              {teacher.verification_status === 'APPROVED' && (
                <div className="text-accent shrink-0" title="Verified Professional">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.25.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Prominent Level Expertise */}
            <div className="flex flex-wrap gap-1">
              {teacher.level_expertise.map((lvl) => (
                <span key={lvl} className="px-2 py-0.5 bg-muted text-[10px] font-bold text-muted-foreground uppercase rounded border border-border">
                  {lvl}
                </span>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-border mt-auto">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Hourly Rate</span>
                <span className="font-extrabold text-primary">NPR {teacher.rate_per_session}</span>
              </div>
              <button className="text-xs font-bold bg-muted hover:bg-border px-3 py-2 rounded-lg transition-colors">
                View Profile
              </button>
            </div>
          </div>
        </div>
      ))}
    </Carousel>
  );
};

export default TrendingSessions;
