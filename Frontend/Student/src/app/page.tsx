"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks";
import CTA from "@/components/Home/CTA";
import HeroSection from "@/components/Home/HeroSection";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Home() {
  const { data: user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  // Show spinner briefly while auth resolves
  if (isLoading) return <LoadingSpinner />;

  // Already redirecting if user is logged in — render nothing to avoid flash
  if (user) return null;

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <HeroSection />
      <CTA />
    </main>
  );
}
