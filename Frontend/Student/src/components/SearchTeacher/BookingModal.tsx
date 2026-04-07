import React, { useState, useMemo, useCallback } from 'react';
import { TeacherSubjectRead } from '../types';

interface BookingModalProps {
  isOpen: boolean;
  teacherSubject: TeacherSubjectRead | null;
  teacherName: string;
  onClose: () => void;
  onConfirm: (
    teacherSubject: TeacherSubjectRead,
    numberOfSessions: number,
    totalAmount: number
  ) => void;
  isLoading?: boolean;
}

const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  teacherSubject,
  teacherName,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [numberOfSessions, setNumberOfSessions] = useState(1);
  const [negotiatedRate, setNegotiatedRate] = useState<number | null>(null);

  const currentRate = negotiatedRate !== null ? negotiatedRate : (teacherSubject?.rate_per_session || 0);

  const totalAmount = useMemo(() => {
    return currentRate * numberOfSessions;
  }, [currentRate, numberOfSessions]);

  const handleConfirm = useCallback(() => {
    if (teacherSubject) {
      onConfirm(teacherSubject, numberOfSessions, totalAmount);
    }
  }, [teacherSubject, numberOfSessions, totalAmount, onConfirm]);

  const handleSessionChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (num > 0) {
        setNumberOfSessions(num);
      }
    },
    []
  );

  const handleDecrement = useCallback(() => {
    setNumberOfSessions((prev) => (prev > 1 ? prev - 1 : 1));
  }, []);

  const handleIncrement = useCallback(() => {
    setNumberOfSessions((prev) => prev + 1);
  }, []);

  if (!isOpen || !teacherSubject) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-surface border border-border rounded-[2.5rem] shadow-2xl max-w-lg w-full pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-muted/30 border-b border-border/50 px-8 py-5">
            <div className="flex items-start justify-between gap-4 mb-0">
              <div className="flex-1">
                <h2 className="text-2xl font-black tracking-tight mb-2">Book Session</h2>
                <p className="text-base font-black text-primary mb-1">{teacherSubject.subject.name}</p>
                <p className="text-xs text-muted-foreground">with {teacherName}</p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1"
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-5 space-y-4">
            {/* Rate Section - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Teacher's Rate */}
              <div className="bg-muted/20 rounded-xl p-3 border border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Their Rate
                </p>
                <p className="text-lg font-black text-foreground">
                  NPR <span className="text-primary text-xl">{teacherSubject.rate_per_session}</span>
                </p>
              </div>

              {/* Your Rate */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                  Your Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">NPR</span>
                  <input
                    type="number"
                    value={negotiatedRate !== null ? negotiatedRate : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setNegotiatedRate(null);
                      } else {
                        const num = parseFloat(value);
                        if (num > 0) {
                          setNegotiatedRate(num);
                        }
                      }
                    }}
                    disabled={isLoading}
                    placeholder={teacherSubject.rate_per_session.toString()}
                    min="0"
                    step="50"
                    className="w-full bg-surface border border-border rounded-lg pr-3 pl-12 py-3.5 text-base font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Session Quantity */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Sessions
              </label>
              <div className="flex items-center gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/50">
                <button
                  onClick={handleDecrement}
                  disabled={numberOfSessions === 1 || isLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface border border-border hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm"
                >
                  −
                </button>
                <input
                  type="number"
                  value={numberOfSessions}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  disabled={isLoading}
                  min="1"
                  className="flex-1 text-center text-base font-black bg-transparent border-0 outline-none disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleIncrement}
                  disabled={isLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface border border-border hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total Amount */}
            <div className="bg-primary/15 border-2 border-primary rounded-xl p-3.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Total to Pay
              </p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-primary">
                  NPR {totalAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground font-semibold">
                  {numberOfSessions}×NPR {currentRate}
                </p>
              </div>
              {negotiatedRate !== null && negotiatedRate !== teacherSubject.rate_per_session && (
                <p className="text-xs font-semibold text-primary mt-2 pt-2 border-t border-primary/30">
                  Counter: NPR {negotiatedRate}
                </p>
              )}
            </div>
          </div>

          {/* Footer / Actions */}
          <div className="bg-muted/20 border-t border-border/50 px-8 py-4 flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-muted text-foreground py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Confirm Booking Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BookingModal;
