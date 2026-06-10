"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/GuruBhet.png" alt="Logo" width={150} height={37} className="dark:invert" />
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-3">
          <Link
            href="/search-teacher"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Search Teacher
          </Link>
          <Link
            href={process.env.NEXT_PUBLIC_TEACHER_APP_URL ? `${process.env.NEXT_PUBLIC_TEACHER_APP_URL}/signup` : "#"}
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Become a Teacher
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-3 py-2 text-base text-primary-foreground hover:opacity-90"
          >
            Sign up
          </Link>
        </nav>

        {/* Hamburger button — mobile only */}
        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted transition-colors"
        >
          {mobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-border bg-background/95 backdrop-blur px-4 py-3 flex flex-col gap-1 shadow-lg"
        >
          <Link
            href="/search-teacher"
            onClick={() => setMobileOpen(false)}
            className="rounded-md px-3 py-2.5 text-base text-foreground hover:bg-muted"
          >
            Search Teacher
          </Link>
          <Link
            href={process.env.NEXT_PUBLIC_TEACHER_APP_URL ? `${process.env.NEXT_PUBLIC_TEACHER_APP_URL}/signup` : "#"}
            onClick={() => setMobileOpen(false)}
            className="rounded-md px-3 py-2.5 text-base text-foreground hover:bg-muted"
          >
            Become a Teacher
          </Link>
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="rounded-md px-3 py-2.5 text-base text-foreground hover:bg-muted"
          >
            Login
          </Link>
          <Link
            href="/signup"
            onClick={() => setMobileOpen(false)}
            className="rounded-md bg-primary px-3 py-2.5 text-base text-primary-foreground hover:opacity-90"
          >
            Sign up
          </Link>
        </nav>
      )}
    </header>
  );
}
