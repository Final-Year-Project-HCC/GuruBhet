"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import { Booking } from "@/lib/types";
import {
  MdMessage,
  MdCheckCircle,
  MdCancel,
  MdWarning,
  MdSchedule,
  MdStarRate,
  MdVideocam,
} from "react-icons/md";

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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason,
      });
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

  // Submit review mutation
  const reviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      return await apiClient.post(`/bookings/${booking.id}/review`, data);
    },
    onSuccess: () => {
      toast.success("Review submitted! Thank you!");
      setShowReviewModal(false);
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to submit review");
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
      toast.error(
        error.response?.data?.detail || "Payment failed. Please try again.",
      );
    },
  });

  const teacherName = booking.teacher
    ? `${booking.teacher.firstName} ${booking.teacher.lastName}`
    : "Unknown Teacher";

  // Calculate remaining time until session
  const sessionDate = new Date(booking.createdAt);
  const now = new Date();
  const diffMs = sessionDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  const getTimeUntilSession = () => {
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else if (diffMs > 0) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return `${mins}m`;
    } else {
      return "Session started";
    }
  };

  const handleCancel = () => {
    const reason = window.prompt(
      "Please tell us why you're cancelling this booking:",
    );
    if (reason !== null && reason.trim()) {
      cancelMutation.mutate(reason.trim());
    }
  };

  const handleSubmitReview = () => {
    if (reviewComment.trim()) {
      reviewMutation.mutate({ rating: reviewRating, comment: reviewComment });
    } else {
      toast.warning("Please add a comment for your review");
    }
  };

  const handlePayNow = () => {
    paymentMutation.mutate();
  };

  const isProcessing =
    cancelMutation.isPending ||
    reviewMutation.isPending ||
    paymentMutation.isPending;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all hover:shadow-lg ${isProcessing ? "opacity-50 pointer-events-none" : ""
        }`}
    >
      <div className="border-b border-border bg-linear-to-r from-subtle to-surface-muted p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-3 flex-1 min-w-0">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-accent">
              {booking.teacher?.image ? (
                <Image
                  src={booking.teacher.image}
                  alt={teacherName}
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold bg-accent text-accent-foreground">
                  {booking.teacher?.firstName?.[0] || "T"}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate text-sm md:text-base">
                {teacherName}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <MdStarRate
                      key={i}
                      className={`h-3 w-3 ${i < Math.round(booking.teacher?.avgRating || 0)
                        ? "fill-warning text-warning"
                        : "text-muted-foreground"
                        }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {booking.teacher?.avgRating?.toFixed(1) || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {booking.subject?.name || "Unknown Subject"}
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-subtle p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Duration
            </p>
            <p className="mt-1.5 text-lg font-bold text-foreground">
              {booking.sessionDurationMinutes}m
            </p>
          </div>

          <div className="rounded-lg bg-subtle p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Amount
            </p>
            <p className="mt-1.5 text-lg font-bold text-foreground">
              Rs {booking.totalAmount.toLocaleString("en-IN")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Rs {booking.ratePerSession.toLocaleString("en-IN")}/session
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {booking.totalSessions > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Sessions Progress</p>
              <p className="font-semibold text-foreground">
                {booking.completedSessions}/{booking.totalSessions}
              </p>
            </div>
          )}
        </div>

        {booking.totalSessions > 1 && (
          <div className="flex gap-1 pt-2">
            {Array.from({ length: booking.totalSessions }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i < booking.completedSessions ? "bg-success" : "bg-muted"
                  }`}
              />
            ))}
          </div>
        )}

        {booking.status === "PENDING_PAYMENT" && (
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 flex items-center gap-2">
            <MdWarning className="h-4 w-4 text-warning shrink-0" />
            <span className="text-sm text-warning font-medium">
              Payment pending - Please complete payment to confirm session
            </span>
          </div>
        )}

        {booking.status === "PENDING_APPROVAL" && (
          <div className="rounded-lg bg-subtle border border-border p-3 flex items-center gap-2">
            <MdSchedule className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              Waiting for teacher approval...
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-surface-muted p-5 space-y-3">
        {booking.status === "PENDING_APPROVAL" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Teacher will respond within 24 hours
            </p>
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="w-full rounded-lg border border-destructive bg-transparent px-4 py-2.5 font-medium text-destructive transition-all hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
            </button>
          </div>
        )}

        {booking.status === "PENDING_PAYMENT" && (
          <div className="flex gap-3">
            <button
              onClick={handlePayNow}
              disabled={paymentMutation.isPending}
              className="flex-1 rounded-lg bg-accent text-accent-foreground px-4 py-2.5 font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {paymentMutation.isPending ? "Processing..." : "Pay Now"}
            </button>
            <button className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-all hover:bg-subtle disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
              <MdMessage className="h-4 w-4" />
              Message
            </button>
          </div>
        )}

        {booking.status === "ACTIVE" && (
          <div className="space-y-2">
            <button className="w-full rounded-lg bg-accent text-accent-foreground px-4 py-2.5 font-medium transition-all hover:opacity-90 text-sm">
              Accept Session
            </button>
            <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-all hover:bg-subtle text-sm">
              <MdMessage className="h-4 w-4" />
              Message Teacher
            </button>
          </div>
        )}

        {booking.status === "COMPLETED" && (
          <div className="space-y-2">
            {!booking.hasReview ? (
              <>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="w-full rounded-lg bg-accent text-accent-foreground px-4 py-2.5 font-medium transition-all hover:opacity-90 text-sm flex items-center justify-center gap-2"
                >
                  <MdStarRate className="h-4 w-4" />
                  Leave a Review
                </button>
                <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-all hover:bg-subtle text-sm">
                  <MdMessage className="h-4 w-4" />
                  Message Teacher
                </button>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm font-medium text-success">
                  ✓ Review submitted
                </p>
              </div>
            )}
          </div>
        )}

        {booking.status.includes("CANCELLED") && (
          <div className="space-y-2">
            {booking.cancellationReason && (
              <p className="text-xs text-muted-foreground text-left">
                Reason: {booking.cancellationReason}
              </p>
            )}
            <div className="text-center">
              <span
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${statusColor}`}
              >
                {booking.status === "PENDING_APPROVAL" && (
                  <MdWarning className="h-3 w-3" />
                )}
                {booking.status === "PENDING_PAYMENT" && (
                  <MdWarning className="h-3 w-3" />
                )}
                {booking.status === "ACTIVE" && (
                  <MdCheckCircle className="h-3 w-3" />
                )}
                {booking.status === "COMPLETED" && (
                  <MdCheckCircle className="h-3 w-3" />
                )}
                {booking.status.includes("CANCELLED") && (
                  <MdCancel className="h-3 w-3" />
                )}
                {statusLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                How was your session?
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Share your feedback about {teacherName}
              </p>
            </div>

            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <MdStarRate
                    className={`h-6 w-6 ${star <= reviewRating
                      ? "fill-warning text-warning"
                      : "text-muted-foreground"
                      }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="w-full rounded-lg border border-border bg-subtle px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Share your experience... (required)"
              rows={4}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2.5 font-medium text-foreground transition-all hover:bg-subtle"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
                className="flex-1 rounded-lg bg-accent text-accent-foreground px-4 py-2.5 font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentBookingCard;
