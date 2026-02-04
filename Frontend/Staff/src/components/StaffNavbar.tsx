"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function StudentNavbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    try {
      //will update later
    } catch (e) {
      // no-op
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/GuruBhet.png" alt="Logo" width={150} height={37} className="dark:invert"/>
          </Link>
        </div>

        <nav className="flex items-center gap-3">
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Open profile menu"
              onClick={() => setOpen((v) => !v)}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black text-sm font-medium text-white ring-1 ring-border hover:opacity-90 dark:bg-white dark:text-black"
            >
              {/* Simple avatar fallback (could be replaced with user image) */}
              <span className="select-none">S</span>
              {/* Chevron indicator overlay (down/up based on open) */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-0 bottom-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-foreground ring-1 ring-border shadow-sm dark:bg-black dark:text-white"
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
                <button
                  className="block w-full px-4 py-2 text-left text-base text-foreground hover:bg-muted"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
