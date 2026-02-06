
import React from 'react';
import Carousel from './Carousel';
import { ACTIVE_SESSIONS } from '../constants';

const ActiveSessions: React.FC = () => {
  return (
    <div className="bg-muted/50 border-y border-border">
      <Carousel 
        title="Your Active Sessions" 
        subtitle="Manage your current learning tracks and upcoming 1-to-1 classes."
      >
        {ACTIVE_SESSIONS.map((session) => {
          const progress = session.completed_sessions && session.total_sessions 
            ? Math.round((session.completed_sessions / session.total_sessions) * 100) 
            : 0;

          return (
            <div 
              key={session.id} 
              className="min-w-[320px] sm:min-w-[360px] bg-white rounded-2xl border border-border p-6 scroll-snap-align-start transition-all cursor-pointer relative overflow-hidden flex flex-col hover:shadow-lg"
            >
              {/* Status Header */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${session.status === 'Live' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}></div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${session.status === 'Live' ? 'text-red-600' : 'text-blue-600'}`}>
                    {session.status === 'Live' ? 'Ongoing Session' : 'Enrolled Course'}
                  </span>
                </div>
                {session.next_session_time && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md uppercase tracking-tight">
                    {session.next_session_time}
                  </span>
                )}
              </div>

              {/* Course Info */}
              <div className="mb-4">
                <h3 className="font-extrabold text-xl leading-tight mb-1 group-hover:text-primary transition-colors">
                  {session.subject}
                </h3>
                <div className="flex items-center gap-2">
                  <img 
                    src={`https://picsum.photos/seed/${session.teacherName}/32/32`} 
                    className="w-6 h-6 rounded-full grayscale hover:grayscale-0 transition-all" 
                    alt={session.teacherName} 
                  />
                  <p className="text-xs font-semibold text-muted-foreground">with {session.teacherName}</p>
                </div>
              </div>

              {/* Progress Bar Section */}
              <div className="mt-auto pt-4 border-t border-border/50">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Progress</p>
                    <p className="text-sm font-black text-foreground">
                      {session.completed_sessions} / {session.total_sessions} <span className="text-muted-foreground font-medium text-xs">Sessions</span>
                    </p>
                  </div>
                  <span className="text-sm font-black text-primary">{progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div 
                    style={{ width: `${progress}%` }}
                    className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
                  />
                </div>
              </div>

              {/* Quick Action Button */}
              <button 
                className={`w-full mt-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                  session.status === 'Live' 
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200' 
                  : 'bg-primary text-primary-foreground hover:bg-destructive'
                }`}
              >
                {session.status === 'Live' ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Enter Classroom
                  </>
                ) : (
                  'View Course Material'
                )}
              </button>
            </div>
          );
        })}
      </Carousel>
    </div>
  );
};

export default ActiveSessions;
