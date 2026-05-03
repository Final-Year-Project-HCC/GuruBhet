"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import { X, Star } from "lucide-react";

export interface RatingModalBookingContext {
  bookingId: string;
  teacherName: string;
  subjectName: string;
  totalSessions: number;
  completedSessions: number;
}

interface RatingModalProps {
  booking: RatingModalBookingContext;
  onClose: () => void;
  /** Called after a successful submission so parent can refresh state */
  onSuccess?: () => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ booking, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [selectedScore, setSelectedScore] = useState<number>(0);
  const [comment, setComment] = useState("");

  const submitMutation = useMutation({
    mutationFn: async (payload: { bookingId: string; score: number; comment?: string }) => {
      const { data } = await apiClient.post("/ratings/", {
        bookingId: payload.bookingId,
        score: payload.score,
        comment: payload.comment || undefined,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Review submitted! Thank you for your feedback.");
      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
      onSuccess?.();
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to submit review. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (selectedScore === 0) {
      toast.warning("Please select a star rating before submitting.");
      return;
    }
    submitMutation.mutate({
      bookingId: booking.bookingId,
      score: selectedScore,
      comment: comment.trim() || undefined,
    });
  };

  const starLabel = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  const activeStar = hoveredStar || selectedScore;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">Rate your experience</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Share feedback for this booking</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Booking Context */}
        <div className="mx-6 mt-5 rounded-2xl bg-muted/40 border border-border p-4">
          <p className="text-sm font-bold text-foreground">{booking.teacherName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{booking.subjectName}</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex gap-0.5">
              {Array.from({ length: booking.totalSessions }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-5 rounded-full ${
                    i < booking.completedSessions ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {booking.completedSessions}/{booking.totalSessions} sessions
            </span>
          </div>
        </div>

        {/* Star Rating */}
        <div className="px-6 pt-6">
          <p className="text-sm font-bold text-foreground mb-3">Overall rating</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setSelectedScore(star)}
                  className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                  aria-label={`Rate ${star} out of 5`}
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${
                      star <= activeStar
                        ? "fill-foreground text-foreground"
                        : "fill-transparent text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            {activeStar > 0 && (
              <span className="text-sm font-bold text-muted-foreground ml-1">
                {starLabel[activeStar]}
              </span>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="px-6 pt-5">
          <label className="text-sm font-bold text-foreground block mb-2">
            Comment <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience with this teacher…"
            rows={3}
            maxLength={1000}
            className="w-full bg-muted/30 border border-border rounded-2xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">{comment.length}/1000</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border bg-transparent px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedScore === 0 || submitMutation.isPending}
            className="flex-1 rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
