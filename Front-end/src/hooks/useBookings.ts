import { useState, useEffect, useMemo } from "react";
import { bookingService } from "src/api/bookingservice";
import { BookingResponse, Member, Journal, Abonnement } from "src/types/shared";

interface BookingWithMember extends BookingResponse {
  member?: Member;
  journal?: Journal;
  abonnement?: Abonnement;
  fullName?: string;
  subscriptionTypes: {
    type: string;
    journal?: Journal;
    abonnement?: Abonnement;
  }[];
}

export function useBookings(selectedDate: Date, initialSpaces: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ✅ Fetch only once on mount
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setIsLoading(true);
        const bookingsData = await bookingService.getAllBookings();

        // Fetch spaces change or enrich async here if needed
        // const enrichedBookings = await enrichBookingsWithMemberData(bookingsData);

        setBookings(bookingsData);
      } catch (error: any) {
        setBookingError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // ✅ Derived data — computed efficiently and automatically when dependencies change
  const filteredBookings = useMemo(() => {
    if (!bookings.length) return [];

    return bookings.filter((booking) =>
      booking.subscriptionTypes.some((sub: any) => {
        if (sub.type === "Journal" && sub.journal?.registredTime) {
          const journalDate = new Date(sub.journal.registredTime);
          return (
            journalDate.getFullYear() === selectedDate.getFullYear() &&
            journalDate.getMonth() === selectedDate.getMonth() &&
            journalDate.getDate() === selectedDate.getDate() &&
            (!sub.journal.leaveTime ||
              new Date(sub.journal.leaveTime) > new Date())
          );
        }
        if (sub.type === "Membership" && sub.abonnement?.registredDate) {
          return (
            !sub.abonnement.leaveDate ||
            new Date(sub.abonnement.leaveDate) > new Date()
          );
        }
        return false;
      })
    );
  }, [bookings, selectedDate]);

  // ✅ Derived data for seat counts — calculated only when filteredBookings changes
  const { totalSeats, availableSeats, bookedSeats } = useMemo(() => {
    if (!initialSpaces)
      return { totalSeats: 0, availableSeats: 0, bookedSeats: 0 };

    const totalSeats = Object.values(initialSpaces).reduce(
      (acc: number, space: any) =>
        acc +
        space.tables.reduce(
          (tableAcc: number, table: any) => tableAcc + table.chairs.length,
          0
        ),
      0
    );

    const bookedSeats = filteredBookings.length;
    const availableSeats = totalSeats - bookedSeats;

    return { totalSeats, availableSeats, bookedSeats };
  }, [initialSpaces, filteredBookings]);

  return {
    bookings,
    filteredBookings,
    totalSeats,
    availableSeats,
    bookedSeats,
    isLoading,
    bookingError,
  };
}
