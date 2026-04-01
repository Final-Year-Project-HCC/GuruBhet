import React, { createContext, useContext, useState } from "react";

interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  subjectId: string;
  sessionStartTime: string;
  sessionEndTime: string;
  status: string;
}

interface BookingContextType {
  currentBookingId: string | null;
  currentBooking: Booking | null;
  setCurrentBookingId: (id: string | null) => void;
  setCurrentBooking: (booking: Booking | null) => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);

  return (
    <BookingContext.Provider
      value={{
        currentBookingId,
        currentBooking,
        setCurrentBookingId,
        setCurrentBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBooking must be used within BookingProvider");
  }
  return context;
}
