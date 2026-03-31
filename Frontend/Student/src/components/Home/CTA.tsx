import React from "react";

const CTA: React.FC = () => {
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
          <button className="bg-background text-foreground px-10 py-5 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-xl">
            Explore All Tutors
          </button>
          <button className="border border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground px-10 py-5 rounded-2xl font-bold text-lg hover:bg-primary-foreground/20 transition-colors">
            Apply to Teach
          </button>
        </div>

        <div className="mt-16 pt-16 border-t border-primary-foreground/10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="text-4xl font-extrabold mb-1">98%</p>
            <p className="text-sm opacity-60">Satisfaction Rate</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold mb-1">500+</p>
            <p className="text-sm opacity-60">Verified Tutors</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold mb-1">10k+</p>
            <p className="text-sm opacity-60">Success Stories</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold mb-1">24/7</p>
            <p className="text-sm opacity-60">Academic Support</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
