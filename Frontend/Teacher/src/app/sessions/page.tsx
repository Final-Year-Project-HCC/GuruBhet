"use client";
import { useState } from 'react';
import { Search, Calendar, Clock, MoreVertical, Play, CheckCircle, AlertCircle } from 'lucide-react';

type SubjectLevel = '10' | '11-12' | 'Bachelor' | 'Master' | 'Diploma';

interface Session {
  id: string;
  teacherName: string;
  subject: string;
  subjectLevel: SubjectLevel;
  status: 'Active' | 'Live' | 'Scheduled' | 'Completed';
  duration_minutes: number;
  completed_sessions?: number;
  total_sessions?: number;
  next_session_time?: string;
  completion_date?: string;
  rating_given?: number;
}

interface TeacherSession extends Session {
  studentName: string;
  studentImage: string;
}

const TEACHER_SESSIONS: TeacherSession[] = [
  {
    id: 'ts1',
    teacherName: 'James Wilson',
    studentName: 'Aayush Sharma',
    studentImage: 'https://picsum.photos/seed/aayush/100/100',
    subject: 'Quantum Physics',
    subjectLevel: 'Bachelor',
    status: 'Live',
    duration_minutes: 60,
    next_session_time: 'Now',
    completed_sessions: 4,
    total_sessions: 10
  },
  {
    id: 'ts2',
    teacherName: 'James Wilson',
    studentName: 'Bipul Chhetri',
    studentImage: 'https://picsum.photos/seed/bipul/100/100',
    subject: 'Advanced Mechanics',
    subjectLevel: 'Master',
    status: 'Scheduled',
    duration_minutes: 90,
    next_session_time: 'Today, 4:00 PM',
    completed_sessions: 2,
    total_sessions: 8
  },
  {
    id: 'ts3',
    teacherName: 'James Wilson',
    studentName: 'Sita Ram',
    studentImage: 'https://picsum.photos/seed/sita/100/100',
    subject: 'Thermodynamics',
    subjectLevel: 'Bachelor',
    status: 'Scheduled',
    duration_minutes: 60,
    next_session_time: 'Tomorrow, 10:00 AM',
    completed_sessions: 0,
    total_sessions: 5
  }
];

const TeacherSessions: React.FC = () => {
  const [filter, setFilter] = useState<'All' | 'Live' | 'Scheduled' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = TEACHER_SESSIONS.filter(session => {
    const matchesFilter = filter === 'All' || session.status === filter;
    const matchesSearch = 
      session.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Sessions</h1>
          <p className="text-muted-foreground">Manage your upcoming and past teaching sessions.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold hover:bg-opacity-90 transition-all shadow-lg flex items-center justify-center gap-2">
          <Calendar size={20} />
          Schedule New
        </button>
      </div>

      <div className="flex flex-col md:flex-row  items-center gap-4 mb-8">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input 
            type="text" 
            placeholder="Search by student or subject..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-border rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </div>
        <div className="flex items-center justify-end gap-2 overflow-x-auto no-scrollbar w-full md:w-2xl pb-2 md:pb-0">
          {['All', 'Live', 'Scheduled', 'Completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as 'All' | 'Live' | 'Scheduled' | 'Completed')}
              className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                filter === f 
                  ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                  : 'bg-white text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredSessions.map((session) => (
          <div 
            key={session.id}
            className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-all group"
          >
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                <img 
                  src={session.studentImage} 
                  alt={session.studentName} 
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-muted shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center ${
                  session.status === 'Live' ? 'bg-red-500' : 'bg-green-500'
                }`}>
                  {session.status === 'Live' ? <Play size={12} className="text-white fill-current" /> : <Calendar size={12} className="text-white" />}
                </div>
              </div>

              <div className="flex-grow text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2 justify-center md:justify-start">
                  <h3 className="text-xl font-bold">{session.studentName}</h3>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit mx-auto md:mx-0 ${
                    session.status === 'Live' 
                      ? 'bg-red-100 text-red-700 animate-pulse' 
                      : session.status === 'Scheduled'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {session.status}
                  </span>
                </div>
                <p className="text-muted-foreground font-medium mb-4">{session.subject} • {session.subjectLevel}</p>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <span>{session.duration_minutes} Minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    <span>{session.next_session_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-primary" />
                    <span>{session.completed_sessions}/{session.total_sessions} Sessions</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto">
                {session.status === 'Live' ? (
                  <button className="flex-grow md:flex-none bg-red-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2">
                    Join Classroom
                  </button>
                ) : (
                  <button className="flex-grow md:flex-none bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-bold hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20">
                    View Details
                  </button>
                )}
                {/* <button className="p-3 bg-muted/50 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                  <MoreVertical size={20} />
                </button> */}
              </div>
            </div>
            
            <div className="bg-muted/30 px-8 py-4 flex items-center justify-between border-t border-border/50">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <AlertCircle size={14} />
                <span>Next payment: NPR 1,200 upon completion</span>
              </div>
              <button className="text-xs font-bold text-primary hover:underline">Reschedule</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherSessions;
