
import React from 'react';
import Image from 'next/image';
import { ACTIVE_SESSIONS, COMPLETED_SESSIONS } from '../constants';

const SessionsPage: React.FC = () => {
  const activeStats = {
    total: ACTIVE_SESSIONS.length,
    remaining: ACTIVE_SESSIONS.reduce((acc, s) => acc + ((s.total_sessions || 0) - (s.completed_sessions || 0)), 0),
    liveCount: ACTIVE_SESSIONS.filter(s => s.status === 'Live').length
  };

  const completedStats = {
    total: COMPLETED_SESSIONS.length,
    totalHours: COMPLETED_SESSIONS.reduce((acc, s) => acc + (s.duration_minutes * (s.completed_sessions || 1)) / 60, 0),
    avgRating: (COMPLETED_SESSIONS.reduce((acc, s) => acc + (s.rating_given || 0), 0) / COMPLETED_SESSIONS.length).toFixed(1)
  };

  return (
    <div className="bg-surface-muted min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-primary">My Learning Dashboard</h1>
          <p className="text-muted-foreground mt-2 font-medium">Track your progress and manage your 1-to-1 education journey.</p>
        </div>

        {/* Section 1: Active Sessions */}
        <div className="mb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-primary">Active Learning Tracks</h2>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mt-1">Ongoing & Upcoming Classes</p>
            </div>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">{activeStats.total}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">Tracks</p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">{activeStats.remaining}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">To Go</p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-success leading-none">{activeStats.liveCount}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">Live Now</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ACTIVE_SESSIONS.map((session) => {
              const progress = session.completed_sessions && session.total_sessions 
                ? Math.round((session.completed_sessions / session.total_sessions) * 100) 
                : 0;

              return (
                <div 
                  key={session.id} 
                  className="bg-surface rounded-[2.5rem] border border-border p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${session.status === 'Live' ? 'bg-destructive animate-pulse' : 'bg-accent'}`}></div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${session.status === 'Live' ? 'text-destructive' : 'text-accent'}`}>
                        {session.status === 'Live' ? 'Session In Progress' : session.status}
                      </span>
                    </div>
                    {session.next_session_time && (
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-xl uppercase">
                        {session.next_session_time}
                      </span>
                    )}
                  </div>

                  <div className="mb-6">
                    <h3 className="font-black text-2xl leading-tight mb-2 group-hover:text-primary transition-colors">
                      {session.subject}
                    </h3>
                    <div className="flex items-center gap-3">
                      <Image
                        src={`https://picsum.photos/seed/${session.teacherName}/48/48`}
                        width={48}
                        height={48}
                        className="w-8 h-8 rounded-full grayscale group-hover:grayscale-0 transition-all border border-border shadow-sm"
                        alt={session.teacherName}
                      />
                      <p className="text-sm font-bold text-muted-foreground">Taught by {session.teacherName}</p>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="flex justify-between items-end mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Course Progress</span>
                        <span className="text-lg font-black text-primary">
                          {session.completed_sessions} <span className="text-muted-foreground text-sm font-bold">/ {session.total_sessions} Sessions</span>
                        </span>
                      </div>
                      <span className="text-lg font-black text-primary">{progress}%</span>
                    </div>
                    <div className="w-full bg-subtle rounded-full h-2.5 overflow-hidden mb-8">
                      <div 
                        style={{ width: `${progress}%` }}
                        className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
                      />
                    </div>

                    <button 
                      className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-lg active:scale-95 ${
                        session.status === 'Live' 
                        ? 'bg-destructive text-destructive-foreground hover:opacity-90' 
                        : 'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-hover-foreground'
                      }`}
                    >
                      {session.status === 'Live' ? 'Enter Classroom Now' : 'Manage Course'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Completed Sessions */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-primary">Completed History</h2>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mt-1">Review your past achievements</p>
            </div>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">{completedStats.total}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">Courses</p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">{completedStats.totalHours.toFixed(0)}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">Hours</p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-warning leading-none">{completedStats.avgRating}</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">Avg Rating</p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-subtle border-b border-border">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Course Subject</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tutor</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Duration</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Completed On</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">My Rating</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {COMPLETED_SESSIONS.map((session) => (
                    <tr key={session.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="px-8 py-6">
                        <div>
                          <p className="font-black text-primary">{session.subject}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{session.subjectLevel} Level</p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <Image
                            src={`https://picsum.photos/seed/${session.teacherName}/32/32`}
                            width={32}
                            height={32}
                            className="w-6 h-6 rounded-full border border-border"
                            alt={session.teacherName}
                          />
                          <span className="text-sm font-bold text-muted-foreground">{session.teacherName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black text-primary">{session.total_sessions} Sessions</span>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{session.duration_minutes}m / each</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-bold text-muted-foreground">{session.completion_date}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <svg 
                              key={i} 
                              className={`w-3.5 h-3.5 ${(session.rating_given || 0) > i ? 'text-warning' : 'text-subtle-foreground/30'}`} 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-destructive transition-colors cursor-pointer">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionsPage;
