"use client";
import React from 'react';
import Carousel from './Carousel';
import { ACTIVE_SESSIONS } from './constants';

const ActiveSessions: React.FC = () => {
  return (
    <div className="bg-muted/50 border-y border-border">
      <Carousel 
        title="Live Learning Rooms" 
        subtitle="Jump into a demo session or join a scheduled mastery class."
      >
        {ACTIVE_SESSIONS.map((session) => (
          <div 
            key={session.id} 
            className="min-w-[300px] sm:min-w-[340px] bg-white rounded-2xl border border-border p-6 scroll-snap-align-start hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden"
          >
            {session.status === 'Live' && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-red-600 text-[10px] text-white font-bold uppercase tracking-widest rounded-bl-xl">
                Live Now
              </div>
            )}
            
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-muted rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">
                  {session.subjectLevel} • {session.duration_minutes}m
                </span>
                <h3 className="font-bold text-lg leading-tight truncate max-w-[180px]">{session.subject}</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <img 
                src={`https://picsum.photos/seed/${session.teacherName}/32/32`} 
                className="w-8 h-8 rounded-full" 
                alt={session.teacherName} 
              />
              <p className="text-sm font-medium">Taught by {session.teacherName}</p>
            </div>
            
            <button className="w-full py-3 bg-primary text-primary-foreground hover:bg-destructive rounded-xl text-sm font-bold transition-colors">
              Join Session
            </button>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default ActiveSessions;
