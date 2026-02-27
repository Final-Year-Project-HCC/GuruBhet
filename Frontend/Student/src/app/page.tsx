import ActiveSessions from "@/components/Home/ActiveSessions";
import CTA from "@/components/Home/CTA";
import HeroSection from "@/components/Home/HeroSection";
import RecommendedTeachers from "@/components/Home/RecommendedTeachers";


export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
        <HeroSection />
        <ActiveSessions />
        <RecommendedTeachers />
        <CTA />
    </main>
  );
}
