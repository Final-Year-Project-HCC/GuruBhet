"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import { Booking } from "@/lib/types";
import { MessageCircle, CheckCircle, XCircle, AlertCircle, Star } from "lucide-react";
import RatingModal from "./RatingModal";

interface StudentBookingCardProps {
  booking: Booking;
  statusColor: string;
  statusLabel: string;
}

const StudentBookingCard = ({
  booking,
  statusColor,
  statusLabel,
}: StudentBookingCardProps) => {
  const queryClient = useQueryClient();
  const [showRatingModal, setShowRatingModal] = useState(false);

  const teacherName = booking.teacher
    ? `${booking.teacher.firstName} ${booking.teacher.lastName}`
    : "Unknown Teacher";

  const formattedDate = new Date(booking.createdAt).toLocaleDateString("en-IN");

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiClient.post(`/bookings/${booking.id}/cancel`, { reason });
    },
    onSuccess: () => {
      toast.info("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to cancel booking");
    },
  });

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post(`/bookings/${booking.id}/initiate-payment`);
    },
    onSuccess: () => {
      toast.success("Payment successful!");
      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Payment failed. Please try again.");
    },
  });

  const handleCancel = () => {
    const reason = window.prompt("Please tell us why you're cancelling this booking:");
    if (reason !== null && reason.trim()) {
      cancelMutation.mutate(reason.trim());
    } else if (reason === "") {
      toast.warning("Please provide a reason for cancellation");
    }
  };

  const handlePayNow = () => {
    paymentMutation.mutate();
  };

  const isProcessing = cancelMutation.isPending || paymentMutation.isPending;

  // Determine if student has already rated (either via hasReview flag or rating field)
  const hasRated = booking.hasReview || (booking.rating != null);

  const isHistoryStatus =
    booking.status === "COMPLETED" || booking.status.includes("CANCELLED");

  return (
    <>
      <div
        className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md ${
          isProcessing ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="border-b border-border bg-muted/30 p-5">
          <div className="flex gap-3 mb-4">
            <Link
              href={booking.teacher ? `/teacher-profile/${booking.teacher.id}` : "#"}
              className="flex gap-3 flex-1 min-w-0 group"
            >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border">
              {booking.teacher?.profilePictureUrl ? (
                <Image
                  src={booking.teacher.profilePictureUrl}
                  alt={teacherName}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold bg-muted text-foreground">
                  {booking.teacher?.firstName?.[0] || "T"}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{teacherName}</p>
              <p className="text-sm text-muted-foreground truncate">
                {booking.subject?.name || "Unknown Subject"}
              </p>
            </div>
            </Link>
          </div>

          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${statusColor}`}
          >
            {(booking.status === "PENDING_APPROVAL" || booking.status === "PENDING_PAYMENT") && (
              <AlertCircle className="h-3 w-3" />
            )}
            {booking.status === "ACTIVE" && <CheckCircle className="h-3 w-3" />}
            {booking.status === "COMPLETED" && <CheckCircle className="h-3 w-3" />}
            {booking.status.includes("CANCELLED") && <XCircle className="h-3 w-3" />}
            {statusLabel}
          </span>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="p-5 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Progress
              </p>
              <p className="text-sm font-bold text-foreground">
                {booking.completedSessions} of {booking.totalSessions} sessions
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: booking.totalSessions }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i < booking.completedSessions
                      ? "bg-emerald-500"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Amounts & duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Amount
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                Rs {booking.totalAmount.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rs {booking.ratePerSession.toLocaleString("en-IN")}/session
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Duration
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {booking.sessionDurationMinutes}m
              </p>
              <p className="mt-1 text-xs text-muted-foreground">per session</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Requested on {formattedDate}</p>
        </div>

        {/* ── Footer Actions ──────────────────────────────────────────── */}
        <div className="border-t border-border bg-muted/20 p-5">
          {booking.status === "PENDING_APPROVAL" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Teacher will respond within 24 hours</p>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="w-full rounded-lg border border-destructive bg-transparent px-4 py-2.5 font-medium text-destructive transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel Request"}
              </button>
            </div>
          )}

          {booking.status === "PENDING_PAYMENT" && (
            <div className="flex gap-3">
              <button
                onClick={handlePayNow}
                disabled={paymentMutation.isPending}
                className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paymentMutation.isPending ? "Processing…" : "Pay Now"}
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-opacity hover:opacity-80">
                <MessageCircle className="h-4 w-4" />
                Message
              </button>
            </div>
          )}

          {booking.status === "ACTIVE" && (
            <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-opacity hover:opacity-80">
              <MessageCircle className="h-4 w-4" />
              Message Teacher
            </button>
          )}

          {booking.status === "COMPLETED" && (
            <div className="space-y-3">
              {hasRated ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {booking.rating != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < booking.rating!.score
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {booking.rating.score}/5
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground">Review submitted</p>
                    )}
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-opacity hover:opacity-80">
                    <MessageCircle className="h-4 w-4" />
                    Message Teacher
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium transition-opacity hover:opacity-90"
                  >
                    <Star className="h-4 w-4" />
                    Leave a Review
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-opacity hover:opacity-80">
                    <MessageCircle className="h-4 w-4" />
                    Message Teacher
                  </button>
                </>
              )}
            </div>
          )}

          {booking.status.includes("CANCELLED") && (
            <div className="space-y-3">
              {booking.cancellationReason && (
                <p className="text-xs text-muted-foreground">
                  Reason: {booking.cancellationReason}
                </p>
              )}
              <p className="text-center text-sm font-medium text-destructive">
                Cancelled
                {booking.cancelledAt &&
                  ` on ${new Date(booking.cancelledAt).toLocaleDateString("en-IN")}`}
              </p>
              {!hasRated && (
                <>
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium transition-opacity hover:opacity-90"
                  >
                    <Star className="h-4 w-4" />
                    Leave a Review
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-opacity hover:opacity-80">
                    <MessageCircle className="h-4 w-4" />
                    Message Teacher
                  </button>
                </>
              )}
              {hasRated && (
                <p className="text-center text-xs text-muted-foreground">Review submitted</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && isHistoryStatus && (
        <RatingModal
          booking={{
            bookingId: booking.id,
            teacherName,
            subjectName: booking.subject?.name || "Unknown Subject",
            totalSessions: booking.totalSessions,
            completedSessions: booking.completedSessions,
          }}
          onClose={() => setShowRatingModal(false)}
        />
      )}
    </>
  );
};

export default StudentBookingCard;
