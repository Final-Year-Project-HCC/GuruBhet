
import React from 'react';
import { Calendar, Clock, Users, BookOpen } from 'lucide-react';

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

const TeacherDashboard: React.FC = () => {
  const todaySessions = TEACHER_SESSIONS.filter(s => s.next_session_time?.includes('Today') || s.next_session_time === 'Now');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Namaste, James Wilson! 👋</h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your classes today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
            <Calendar size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Total Sessions</p>
          <h3 className="text-2xl font-bold">124</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-4">
            <Users size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Active Students</p>
          <h3 className="text-2xl font-bold">18</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4">
            <Clock size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Hours Taught</p>
          <h3 className="text-2xl font-bold">45.5</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-4">
            <BookOpen size={24} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Avg. Rating</p>
          <h3 className="text-2xl font-bold">4.9</h3>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Today&apos;s Sessions</h2>
          <button className="text-sm font-medium text-blue-600 hover:underline">View All</button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {todaySessions.length > 0 ? (
            todaySessions.map((session) => (
              <div 
                key={session.id}
                className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:scale-[1.01] transition-transform"
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <img 
                    src={session.studentImage} 
                    alt={session.studentName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="font-bold text-lg">{session.studentName}</h4>
                    <p className="text-sm text-muted-foreground">{session.subject} • {session.subjectLevel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-8 w-full md:w-auto">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-muted-foreground" />
                    <span>{session.duration_minutes} mins</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-muted-foreground" />
                    <span className={session.status === 'Live' ? 'text-red-500 font-bold' : ''}>
                      {session.next_session_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${((session.completed_sessions || 0) / (session.total_sessions || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{session.completed_sessions}/{session.total_sessions}</span>
                  </div>
                </div>

                <div className="w-full md:w-auto">
                  {session.status === 'Live' ? (
                    <button className="w-full md:w-auto bg-red-500 text-white px-6 py-2 rounded-full font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Join Now
                    </button>
                  ) : (
                    <button className="w-full md:w-auto bg-primary text-primary-foreground px-6 py-2 rounded-full font-medium hover:bg-opacity-90 transition-colors">
                      Prepare
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-muted/50 border border-dashed border-border rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">No sessions scheduled for today.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TeacherDashboard;
