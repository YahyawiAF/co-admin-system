import type { SeatBooking } from "@/lib/api/resources";

export function bookingMatchesSeat(
  booking: Pick<SeatBooking, "isBooked" | "seatId"> & {
    spaceId?: string | null;
  },
  spaceId: string,
  seatLabel: string
) {
  if (!booking.isBooked) return false;
  if (booking.seatId !== seatLabel) return false;
  if (booking.spaceId && booking.spaceId !== spaceId) return false;
  return true;
}

export function bookedLabelsForSpace(
  bookings: Array<
    Pick<SeatBooking, "isBooked" | "seatId"> & { spaceId?: string | null }
  >,
  spaceId: string
) {
  return new Set(
    bookings
      .filter((b) => b.isBooked && (!b.spaceId || b.spaceId === spaceId))
      .map((b) => b.seatId)
  );
}

export function bookingForSeatInSpace(
  bookings: Array<
    Pick<SeatBooking, "isBooked" | "seatId"> & { spaceId?: string | null }
  >,
  spaceId: string,
  seatLabel: string
) {
  return bookings.find((b) => bookingMatchesSeat(b, spaceId, seatLabel));
}

export function seatBookKey(spaceId: string, label: string) {
  return `${spaceId}:${label}`;
}

export function compareNaturalLabel(a: string, b: string) {
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
}
