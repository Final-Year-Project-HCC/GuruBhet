"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import apiClient from "@/lib/api";
import StudentBookingCard from "@/components/Bookings/StudentBookingCard";
import {
  MdSchedule,
  MdBook,
  MdCreditCard,
  MdCheckCircle,
  MdWarning,
} from "react-icons/md";
import { Booking } from "../../lib/types";

type TabType = "approval" | "payment" | "upcoming" | "completed";

export default function StudentBookingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");

  // Fetch bookings for the logged-in student
  const { data: bookings = [], isLoading, error } = useQuery<Booking[]>({
    queryKey: ["studentBookings"],
    queryFn: async () => {
      const { data } = await apiClient.get("/students/me/bookings");
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Filter bookings by status
  const approvalBookings = bookings.filter(
    (b) => b.status === "PENDING_APPROVAL"
  );
  const paymentBookings = bookings.filter((b) => b.status === "PENDING_PAYMENT");
  const upcomingBookings = bookings.filter((b) => b.status === "ACTIVE");
  const completedBookings = bookings.filter(
    (b) => b.status === "COMPLETED" || b.status.includes("CANCELLED")
  );

  // Find next session
  const nextSession = upcomingBookings.length > 0 ? upcomingBookings[0] : null;
  const nextSessionTime = nextSession?.startDate
    ? new Date(nextSession.startDate)
    : null;
  const timeUntilNextSession = nextSessionTime
    ? Math.ceil(
        (nextSessionTime.getTime() - new Date().getTime()) / (1000 * 60 * 60)
      )
    : null;

  // Calculate total spent
  const totalSpent = bookings
    .filter((b) => b.status === "COMPLETED" || b.status === "ACTIVE")
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // Tab content mapping
  const tabContent = {
    approval: approvalBookings,
    payment: paymentBookings,
    upcoming: upcomingBookings,
    completed: completedBookings,
  };

  const currentBookings = tabContent[activeTab];

  // Status badge colors using theme variables
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return "bg-subtle text-foreground border border-border";
      case "PENDING_PAYMENT":
        return "bg-warning/10 text-warning border border-warning/30";
      case "ACTIVE":
        return "bg-success/10 text-success border border-success/30";
      case "COMPLETED":
        return "bg-subtle text-foreground border border-border";
      default:
        return "bg-destructive/10 text-destructive border border-destructive/30";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_APPROVAL: "Awaiting Approval",
      PENDING_PAYMENT: "Payment Pending",
      ACTIVE: "Upcoming",
      COMPLETED: "Completed",
    };
    return (
      labels[status] ||
      status.replace(/_/g, " ").charAt(0).toUpperCase() +
        status.replace(/_/g, " ").slice(1).toLowerCase()
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">My Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your tutoring sessions and track your learning progress
          </p>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Upcoming Sessions */}
          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  UPCOMING SESSIONS
                </p>
                <p className="mt-3 text-3xl font-bold text-foreground">
                  {upcomingBookings.length}
                </p>
                {paymentBookings.length > 0 && (
                  <p className="mt-2 text-xs text-warning">
                    {paymentBookings.length} awaiting payment
                  </p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground">
                <MdBook className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Total Investment */}
          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  TOTAL INVESTMENT
                </p>
                <p className="mt-3 text-3xl font-bold text-foreground">
                  
Rs {totalSpent.toLocaleString("en-IN", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  spent on {completedBookings.length} bookings
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground">
                <MdCreditCard className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Alert: Action Required */}
        {approvalBookings.length > 0 && (
          <div className="mb-8 rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
            <MdWarning className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                Waiting for teacher approval
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You have {approvalBookings.length} booking
                {approvalBookings.length > 1 ? "s" : ""} awaiting teacher
                approval. Teachers usually respond within 24 hours.
              </p>
            </div>
          </div>
        )}

        {paymentBookings.length > 0 && (
          <div className="mb-8 rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
            <MdWarning className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Payments pending</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete payment for {paymentBookings.length} booking
                {paymentBookings.length > 1 ? "s" : ""} to confirm your sessions.
              </p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-border">
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`relative px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === "upcoming"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Upcoming ({upcomingBookings.length})
              {activeTab === "upcoming" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"></div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("payment")}
              className={`relative px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === "payment"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Payment ({paymentBookings.length})
              {activeTab === "payment" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"></div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("approval")}
              className={`relative px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === "approval"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Awaiting Approval ({approvalBookings.length})
              {activeTab === "approval" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"></div>
              )}
            </button>

            <button
              onClick={() => setActiveTab("completed")}
              className={`relative px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === "completed"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Completed ({completedBookings.length})
              {activeTab === "completed" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"></div>
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <div className="text-center">
              <div className="mb-4 inline-block animate-spin">
                <div className="h-8 w-8 rounded-full border-4 border-border border-t-foreground"></div>
              </div>
              <p className="text-sm text-muted-foreground">Loading your bookings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-destructive bg-destructive/15">
            <div className="text-center">
              <p className="font-medium text-destructive">
                Failed to load bookings
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please try refreshing the page
              </p>
            </div>
          </div>
        ) : currentBookings.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <div className="text-center space-y-3">
              {activeTab === "upcoming" ? (
                <>
                  <MdBook className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-lg font-medium text-foreground">
                    No upcoming sessions
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Start learning by searching for tutors and booking your first
                    session
                  </p>
                  <button className="mt-4 rounded-lg bg-accent text-accent-foreground px-6 py-2.5 font-medium transition-all hover:opacity-90 text-sm">
                    Search Tutors
                  </button>
                </>
              ) : activeTab === "payment" ? (
                <>
                  <MdCheckCircle className="h-12 w-12 text-success/50 mx-auto" />
                  <p className="text-lg font-medium text-foreground">
                    All caught up! 🎉
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    No pending payments at the moment
                  </p>
                </>
              ) : activeTab === "approval" ? (
                <>
                  <MdSchedule className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-lg font-medium text-foreground">
                    No pending approvals
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    All your booking requests have been processed
                  </p>
                </>
              ) : (
                <>
                  <MdBook className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-lg font-medium text-foreground">
                    No completed bookings
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your completed sessions will appear here
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentBookings.map((booking) => (
              <StudentBookingCard
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
