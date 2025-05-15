export interface BookingResponse {
  id: string;
  eventKey: string;
  seatId: string;
  memberId: string | null;
  isBooked: boolean;
  bookedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  success: boolean;
}