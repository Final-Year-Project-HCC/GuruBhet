import Link from "next/link";
import React from "react";

const CTA: React.FC = () => {
  const teacherAppUrl = process.env.NEXT_PUBLIC_TEACHER_APP_URL ?? "";

  return (
    <section className="bg-primary text-primary-foreground py-24">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
          Transform your learning journey
        </h2>
        <p className="text-lg opacity-80 mb-10 max-w-2xl mx-auto">
          Join students from across Nepal mastering complex subjects with ease.
          Secured by verified profiles and escrowed eSewa payments.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/search-teacher"
            className="bg-background text-foreground px-10 py-5 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-xl inline-block"
          >
            Explore All Tutors
          </Link>
          <a
            href={teacherAppUrl ? `${teacherAppUrl}/signup` : "https://teacher.gurubhet.tech/signup"}
            className="border border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground px-10 py-5 rounded-2xl font-bold text-lg hover:bg-primary-foreground/20 transition-colors"
          >
            Apply to Teach
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTA;
