"use client";
import React from 'react';
import Carousel from './Carousel';
import { LEVELS } from '../constants';

const SubjectLevels: React.FC = () => {
  return (
    <div className="bg-white">
      <Carousel 
        title="Browse by Level" 
        subtitle="Find tutors specialized in your specific academic stage."
      >
        {LEVELS.map((level) => (
          <div 
            key={level.id} 
            className="min-w-[200px] bg-muted/40 hover:bg-muted p-6 rounded-2xl border border-border scroll-snap-align-start transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm border border-border group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-1">{level.id}</h3>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">{level.title}</p>
            <span className="text-sm text-primary font-medium">{level.count}</span>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default SubjectLevels;
