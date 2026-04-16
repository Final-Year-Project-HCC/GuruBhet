"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLogout, useUser } from "@/hooks";

export default function StudentNavbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { mutate: logout, isPending } = useLogout();
  const { data: user } = useUser();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  function handleLogout() {
    logout();
    setOpen(false);
  }

  return (
    <>
      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-white dark:border-gray-600 dark:border-t-white" />
            <p className="text-sm font-medium text-white">Logging out...</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Image
                src="/GuruBhet.png"
                alt="Logo"
                width={150}
                height={37}
                className="dark:invert"
              />
            </Link>
          </div>

          <nav className="flex items-center gap-3">
            {/* Dashboard — only when logged in */}
            {user && (
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
              >
                Dashboard
              </Link>
            )}
            {/* Always visible */}
            <Link
              href="/search-teacher"
              className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
            >
              Search Teacher
            </Link>

            {user ? (
              <>
                {/* Logged-in links */}
                <Link
                  href="/bookings"
                  className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
                >
                  Bookings
                </Link>
                <Link
                  href="/sessions"
                  className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
                >
                  Sessions
                </Link>

                {/* Profile dropdown */}
                <div className="relative" ref={menuRef}>
                  <button
                    aria-label="Open profile menu"
                    onClick={() => setOpen((v) => !v)}
                    className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground ring-1 ring-border hover:opacity-90"
                  >
                    <span className="select-none">S</span>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 bottom-0 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-foreground ring-1 ring-border shadow-sm"
                    >
                      <svg
                        className={`${open ? "rotate-180" : "rotate-0"} transition-transform`}
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  {open && (
                    <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-border bg-background shadow-lg">
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-base text-foreground hover:bg-muted"
                        onClick={() => setOpen(false)}
                      >
                        Account
                      </Link>
                      <Link
                        href="/payment-method"
                        className="block px-4 py-2 text-base text-foreground hover:bg-muted"
                        onClick={() => setOpen(false)}
                      >
                        Payment Method
                      </Link>
                      <button
                        className="block w-full px-4 py-2 text-left text-base text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
                        onClick={handleLogout}
                        disabled={isPending}
                      >
                        {isPending ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Logged-out auth buttons */}
                <Link
                  href="/login"
                  className="rounded-md border border-border px-4 py-2 text-base text-foreground hover:bg-muted"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-primary px-4 py-2 text-base text-primary-foreground hover:opacity-90"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
