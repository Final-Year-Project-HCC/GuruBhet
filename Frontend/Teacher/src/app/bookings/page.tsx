"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import apiClient from "@/lib/api";
import BookingCard from "@/components/BookingCard";
import { Search, TrendingUp, ClipboardList, BookOpen } from "lucide-react";
import { Booking } from "@/lib/types";

type TabType = "requests" | "unpaid" | "active" | "history";

export default function BookingsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const isFirstTime = useRef(true);
  // Fetch bookings for the logged-in teacher
  const { data: bookings = [], isLoading, error } = useQuery<Booking[]>({
    queryKey: ["teacherBookings"],
    queryFn: async () => {
      const { data } = await apiClient.get("/teachers/me/bookings");
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Filter bookings by status
  const requestBookings = bookings.filter((b) => b.status === "PENDING_APPROVAL");
  const unpaidBookings = bookings.filter((b) => b.status === "PENDING_PAYMENT");
  const ongoingBookings = bookings.filter((b) => b.status === "ACTIVE");
  const historyBookings = bookings.filter(
    (b) => b.status === "COMPLETED" || b.status.includes("CANCELLED")
  );
  useEffect(() => {
    if (requestBookings?.length > 0 && isFirstTime.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("requests");
      isFirstTime.current = false;
    }
  }, [requestBookings]);
  // Search filter for history tab
  const filteredHistory = historyBookings.filter((b) =>
    `${b.student?.firstName || ''} ${b.student?.lastName || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Calculate total earned (sum of completed bookings)
  const totalEarned = bookings
    .filter(((b) => b.status === "COMPLETED" || b.status === "CANCELLED_BY_STUDENT"))
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);

  // Tab content mapping
  const tabContent = {
    requests: requestBookings,
    unpaid: unpaidBookings,
    active: ongoingBookings,
    history: filteredHistory,
  };

  const currentBookings = tabContent[activeTab];

  // Status badge colors using theme variables
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return "bg-muted text-foreground border border-border";
      case "PENDING_PAYMENT":
        return "bg-muted text-foreground border border-border";
      case "ACTIVE":
        return "bg-primary text-primary-foreground border border-primary";
      case "COMPLETED":
        return "bg-muted text-muted-foreground border border-border";
      default:
        return "bg-destructive/10 text-destructive border border-destructive";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your booking requests, active sessions, and history
          </p>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  PENDING REQUESTS
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {requestBookings.length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  ACTIVE SESSIONS
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {ongoingBookings.length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  TOTAL EARNED
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">

                  Rs {totalEarned.toLocaleString("en-IN", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-border">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "active"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Active ({ongoingBookings.length})
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "requests"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Requests ({requestBookings.length})
            </button>
            <button
              onClick={() => setActiveTab("unpaid")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "unpaid"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Unpaid ({unpaidBookings.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === "history"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              History ({historyBookings.length})
            </button>
          </div>
        </div>

        {/* Search Bar (only visible in History tab) */}
        {activeTab === "history" && (
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by student name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <div className="text-center">
              <div className="mb-4 inline-block animate-spin">
                <div className="h-8 w-8 rounded-full border-4 border-border border-t-foreground"></div>
              </div>
              <p className="text-sm text-muted-foreground">Loading bookings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-destructive bg-destructive/15">
            <div className="text-center">
              <p className="font-medium text-destructive">Failed to load bookings</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please try refreshing the page
              </p>
            </div>
          </div>
        ) : currentBookings.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <div className="text-center">
              {activeTab === "requests" ? (
                <>
                  <p className="text-xl font-medium text-foreground">All caught up!</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    No pending booking requests right now
                  </p>
                </>
              ) : activeTab === "unpaid" ? (
                <>
                  <p className="text-xl font-medium text-foreground">No unpaid bookings</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    All bookings have been paid
                  </p>
                </>
              ) : activeTab === "active" ? (
                <>
                  <p className="text-xl font-medium text-foreground">No active sessions</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You don&apos;t have any active or pending payment bookings
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-medium text-foreground">No history yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your completed and cancelled bookings will appear here
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                statusColor={getStatusColor(booking.status)}
                statusLabel={getStatusLabel(booking.status)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
