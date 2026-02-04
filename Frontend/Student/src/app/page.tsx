import ActiveSessions from "@/components/Home/ActiveSessions";
import CTA from "@/components/Home/CTA";
import HeroSection from "@/components/Home/HeroSection";
import RecommendedTeachers from "@/components/Home/RecommendedTeachers";
import SubjectLevels from "@/components/Home/SubjectLevels";
import TrendingSessions from "@/components/Home/TrendingSessions";


export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
        <HeroSection />
        {/* <SubjectLevels /> */}
        <ActiveSessions />
        {/* <TrendingSessions /> */}
        <RecommendedTeachers />
        <CTA />
    </main>
  );
}
