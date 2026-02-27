
import React from 'react';
import Image from 'next/image';
import { TRENDING_TEACHERS, RECOMMENDED_TEACHERS } from '../constants';

interface TeacherDetailPageProps {
  teacherId: string;
  onBack: () => void;
}


const TeacherDetailPage: React.FC<TeacherDetailPageProps> = ({ teacherId, onBack }) => {
  
  const allTeachers = [...TRENDING_TEACHERS, ...RECOMMENDED_TEACHERS];
  const teacher = allTeachers.find(t => t.id === teacherId);
  console.log("TeacherDetailPage received teacherId:", teacherId);

  if (!teacher) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <h1 className="text-2xl font-bold mb-4">Teacher not found</h1>
        <button onClick={onBack} className="text-primary font-bold hover:underline">Go back to search</button>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-bold text-sm uppercase tracking-widest">Back to Search</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Left Column: Profile Card */}
          <div className="lg:col-span-1 space-y-8">
            <div 
              className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-xl"
            >
              <div className="aspect-square relative overflow-hidden">
                <Image src={teacher.image} fill sizes="(max-width: 1024px) 100vw, 33vw" className="w-full h-full object-cover" alt={teacher.name} />
                <div className="absolute top-6 left-6">
                  {teacher.verification_status === 'APPROVED' && (
                    <div className="bg-accent text-accent-foreground p-2 rounded-full shadow-lg border border-background/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-8 text-center">
                <h1 className="text-3xl font-black tracking-tight mb-2">{teacher.name}</h1>
                <p className="text-primary font-bold text-sm uppercase tracking-widest mb-6">{teacher.subject}</p>
                
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black tracking-tighter">{teacher.rating || '4.9'}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rating</span>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black tracking-tighter">150+</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Students</span>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black tracking-tighter">5.0</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Years XP</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-lg hover:bg-primary-hover hover:text-primary-hover-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Book a Trial Session
                  </button>
                  <button 
                    className="w-full bg-muted text-foreground py-4 rounded-2xl font-bold text-lg hover:bg-border transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Send Message
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-3xl p-6">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Pricing Details</h4>
              <div className="flex justify-between items-center">
                <span className="font-bold">Standard Hourly Rate</span>
                <span className="text-xl font-black text-primary tracking-tighter">NPR {teacher.rate_per_session}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 italic">*Discount available for 10+ sessions packages</p>
            </div>
          </div>

          {/* Right Column: Detailed Info */}
          <div className="lg:col-span-2 space-y-12">
            <section 
            >
              <h2 className="text-3xl font-black tracking-tight mb-6">About Me</h2>
              <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed text-lg">
                <p className="mb-6">
                  {teacher.tagline || `Expert educator specializing in ${teacher.subject}. Committed to providing personalized 1-to-1 learning experiences that help students achieve their full academic potential.`}
                </p>
                <p>
                  With over 5 years of experience in the educational sector, I have helped hundreds of students navigate complex curricula including SEE/SLC, A-Levels, and Bachelor-level courses. My teaching methodology focuses on conceptual clarity followed by intensive problem-solving sessions.
                </p>
              </div>
            </section>

            <section 
            >
              <h2 className="text-xl font-black mb-6 uppercase tracking-widest text-muted-foreground">Expertise & Levels</h2>
              <div className="flex flex-wrap gap-3">
                {teacher.level_expertise.map((level) => (
                  <div key={level} className="bg-surface border border-border px-6 py-4 rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <div>
                      <p className="text-sm font-black leading-none mb-1 uppercase tracking-tighter">{level}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Verified Expert</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section 
            >
              <h2 className="text-xl font-black mb-6 uppercase tracking-widest text-muted-foreground">Recent Reviews</h2>
              <div className="space-y-4">
                {[
                  { name: "Anish K.", rating: 5, comment: "Excellent explanation of complex topics. Highly recommended!" },
                  { name: "Priya S.", rating: 4, comment: "Very patient and well-prepared for every session." }
                ].map((review, i) => (
                  <div key={i} className="bg-surface border border-border rounded-3xl p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold">{review.name}</h4>
                      <div className="flex gap-0.5">
                        {[...Array(review.rating)].map((_, j) => (
                          <svg key={j} xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-warning" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm italic">{review.comment}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDetailPage;
