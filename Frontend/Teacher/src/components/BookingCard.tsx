"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import { MessageCircle, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Booking } from "@/lib/types";

interface BookingCardProps {
  booking: Booking;
  statusColor: string;
  statusLabel: string;
}

const BookingCard = ({
  booking,
  statusColor,
  statusLabel,
}: BookingCardProps) => {
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Approve booking mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post(`/bookings/${booking.id}/approve`);
    },
    onSuccess: () => {
      toast.success("Booking approved!");
      // Immediately remove from cache to show disappearance instantly
      queryClient.setQueryData(["teacherBookings"], (old: Booking[]) =>
        old.filter((b) => b.id !== booking.id),
      );
      // Then invalidate to refetch for consistency
      queryClient.invalidateQueries({ queryKey: ["teacherBookings"] });
      setIsApproving(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to approve booking");
      setIsApproving(false);
    },
  });

  // Decline booking mutation
  const declineMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason,
      });
    },
    onSuccess: () => {
      toast.success("Booking declined");
      // Immediately remove from cache to show disappearance instantly
      queryClient.setQueryData(["teacherBookings"], (old: Booking[]) =>
        old.filter((b) => b.id !== booking.id),
      );
      // Then invalidate to refetch for consistency
      queryClient.invalidateQueries({ queryKey: ["teacherBookings"] });
      setIsDeclining(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to decline booking");
      setIsDeclining(false);
    },
  });

  const studentName = booking.student
    ? `${booking.student.firstName} ${booking.student.lastName}`
    : "Unknown Student";
  const formattedDate = new Date(booking.createdAt).toLocaleDateString("en-IN");

  const handleApprove = () => {
    setIsApproving(true);
    approveMutation.mutate();
  };

  const handleDecline = () => {
    const reason = window.prompt(
      "Please provide a reason for declining this booking request:",
    );
    if (reason !== null && reason.trim()) {
      setIsDeclining(true);
      declineMutation.mutate(reason.trim());
    } else if (reason === "") {
      toast.warning("Please provide a reason for declining");
    }
  };

  const isRefetching = approveMutation.isPending || declineMutation.isPending;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md ${
        isRefetching ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Header Section */}
      <div className="border-b border-border bg-muted/30 p-5">
        {/* Student Info */}
        <div className="flex gap-3 mb-4">
          {/* Student Avatar */}
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border">
            {booking.student?.profilePictureUrl ? (
              <Image
                src={booking.student.profilePictureUrl}
                alt={studentName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold bg-muted text-foreground">
                {booking.student?.firstName?.[0] || "S"}
              </div>
            )}
          </div>

          {/* Student Name and Subject */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate">{studentName}</p>
            <p className="text-sm text-muted-foreground truncate">
              {booking.subject?.name || "Unknown Subject"}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${statusColor}`}
        >
          {booking.status === "PENDING_APPROVAL" && (
            <AlertCircle className="h-3 w-3" />
          )}
          {booking.status === "PENDING_PAYMENT" && (
            <AlertCircle className="h-3 w-3" />
          )}
          {booking.status === "ACTIVE" && <CheckCircle className="h-3 w-3" />}
          {booking.status === "COMPLETED" && (
            <CheckCircle className="h-3 w-3" />
          )}
          {booking.status.includes("CANCELLED") && (
            <XCircle className="h-3 w-3" />
          )}
          {statusLabel}
        </span>
      </div>

      {/* Contract Details Section */}
      <div className="p-5 space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Progress
            </p>
            <p className="text-sm font-bold text-foreground">
              {booking.completedSessions} of {booking.totalSessions} sessions
            </p>
          </div>
          {/* Segmented Progress Bar */}
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

        {/* Financials and Duration */}
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

        {/* Request Timestamp */}
        <p className="text-xs text-muted-foreground">
          Requested on {formattedDate}
        </p>
      </div>

      {/* Conditional Footer Actions */}
      <div className="border-t border-border bg-muted/20 p-5">
        {booking.status === "PENDING_APPROVAL" && (
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isApproving || approveMutation.isPending}
              className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? "Approving..." : "Approve Request"}
            </button>
            <button
              onClick={handleDecline}
              disabled={isDeclining || declineMutation.isPending}
              className="flex-1 rounded-lg border border-destructive bg-transparent px-4 py-2.5 font-medium text-destructive transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeclining ? "Declining..." : "Decline"}
            </button>
          </div>
        )}

        {booking.status === "PENDING_PAYMENT" && (
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium transition-opacity hover:opacity-90">
              <MessageCircle className="h-4 w-4" />
              Message
            </button>
            <button
              onClick={handleDecline}
              disabled={isDeclining || declineMutation.isPending}
              className="flex-1 rounded-lg border border-destructive bg-transparent px-4 py-2.5 font-medium text-destructive transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeclining ? "Declining..." : "Decline"}
            </button>
          </div>
        )}

        {booking.status === "ACTIVE" && (
          <div className="space-y-3">
            {booking.nextSessionDate && (
              <p className="text-sm text-muted-foreground">
                Next session:{" "}
                <span className="font-medium text-foreground">
                  {new Date(booking.nextSessionDate).toLocaleDateString(
                    "en-IN",
                  )}
                </span>
              </p>
            )}
            <button className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium transition-opacity hover:opacity-90">
              View Sessions
            </button>
          </div>
        )}

        {booking.status === "COMPLETED" && (
          <p className="text-center text-sm font-medium text-foreground">
            ✓ Booking completed
          </p>
        )}

        {booking.status.includes("CANCELLED") && (
          <div className="space-y-2">
            <p className="text-center text-sm font-medium text-destructive">
              Cancelled{" "}
              {booking.cancelledAt &&
                `on ${new Date(booking.cancelledAt).toLocaleDateString("en-IN")}`}
            </p>
            {booking.cancellationReason && (
              <p className="text-xs text-muted-foreground">
                Reason: {booking.cancellationReason}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingCard;
