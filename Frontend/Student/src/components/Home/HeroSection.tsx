import Link from 'next/link';
import React from 'react';
import Image from 'next/image';

const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-background py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verified Nepali Educators</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Master Any Subject with <span className="text-primary underline decoration-muted-foreground underline-offset-4">1-to-1 Experts</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
            From SLC/SEE to Master&apos;s level, connect with verified tutors for personalized sessions tailored to your curriculum.
          </p>

          {/* <div className="bg-white p-2 rounded-2xl shadow-xl border border-border flex flex-col sm:flex-row gap-2 mt-4 max-w-2xl">
            <div className="flex-grow flex items-center px-4 gap-3 bg-muted/50 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Subject (e.g. Physics, Math)" 
                className="bg-transparent border-none focus:ring-0 text-sm py-4 w-full outline-none"
              />
            </div>
            <div className="flex items-center px-4 gap-3 bg-muted/50 rounded-xl min-w-[160px]">
              <select className="bg-transparent border-none focus:ring-0 text-sm py-4 w-full outline-none appearance-none cursor-pointer">
                <option value="">Select Level</option>
                <option value="10">Grade 10</option>
                <option value="11-12">11-12</option>
                <option value="Bachelor">Bachelor</option>
                <option value="Master">Master</option>
                <option value="Diploma">Diploma</option>
              </select>
            </div>
            <button className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold hover:bg-primary-hover hover:text-primary-hover-foreground transition-colors">
              Find
            </button>
          </div> */}
           <div className="mt-4">
            <Link href="/search-teacher">
            <button 
              
              className="group flex cursor-pointer items-center gap-3 bg-primary text-primary-foreground px-8 py-5 rounded-2xl font-bold text-lg hover:bg-primary-hover hover:text-primary-hover-foreground transition-all shadow-xl shadow-primary/10 hover:scale-[1.05] active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-foreground/70 group-hover:text-primary-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search Teachers</span>
            </button>
              </Link>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <Image
                  key={i}
                  src={`https://picsum.photos/seed/${i + 15}/48/48`}
                  width={48}
                  height={48}
                  className="w-10 h-10 rounded-full border-2 border-background"
                  alt="Verified Student"
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Trusted by students from <span className="font-bold text-foreground">TU, KU, and HSEB</span>
            </p>
          </div>
        </div>

        <div className="relative group">
          <div className="relative bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl aspect-video md:aspect-square lg:aspect-4/3 flex items-center justify-center">
            <Image
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800" 
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              alt="Online Learning Session" 
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6 bg-surface/90 backdrop-blur-md p-4 rounded-2xl border border-background/50 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="bg-primary text-primary-foreground p-3 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Identity Verified</p>
                  <p className="text-sm font-bold">Secure eSewa Payouts for Tutors</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
