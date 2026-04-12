"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { Booking } from "@/lib/types";
import { useLogout, useUser } from "@/hooks";

export default function TeacherNavbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { mutate: logout, isPending } = useLogout();
  const { data: user } = useUser();
  
  const avatarUrl = user?.avatarUrl;
  const initial = user?.firstName?.[0]?.toUpperCase() || "T";

  // Fetch pending approval count
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["teacherBookings"],
    queryFn: async () => {
      const { data } = await apiClient.get("/teachers/me/bookings");
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const pendingApprovalCount = bookings.filter(
    (b) => b.status === "PENDING_APPROVAL"
  ).length;

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
      {/* Global loading overlay during logout */}
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
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Dashboard
          </Link>
          <Link
            href="/sessions"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Sessions
          </Link>
          <Link
            href="/bookings"
            className="relative rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Bookings
            {pendingApprovalCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {pendingApprovalCount}
              </span>
            )}
          </Link>
          <Link
            href="/earnings"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Earnings
          </Link>
          <Link
            href="/messages"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Messages
          </Link>
          <Link
            href="/join-room"
            className="rounded-md px-3 py-2 text-base text-foreground hover:bg-muted"
          >
            Join Room
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Open profile menu"
              onClick={() => setOpen((v) => !v)}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black text-sm font-medium text-white ring-1 ring-border hover:opacity-90 dark:bg-white dark:text-black"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  fill
                  sizes="36px"
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="select-none">{initial}</span>
              )}
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
                <Link
                  href="/account"
                  className="block px-4 py-2 text-base text-foreground hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  Account
                </Link>
                <Link
                  href="/public-profile"
                  className="block px-4 py-2 text-base text-foreground hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  Public Profile
                </Link>
                <Link
                  href="/payment-method"
                  className="block px-4 py-2 text-base text-foreground hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  Payment Method
                </Link>
                <button
                  className="block w-full px-4 py-2 text-left text-base text-foreground hover:bg-muted disabled:opacity-50"
                  onClick={handleLogout}
                  disabled={isPending}
                >
                  {isPending ? "Logging out..." : "Logout"}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
    </>
  );
}
