import axios, { AxiosInstance } from 'axios';
import { BookSeatsPayload, BookingResponse } from 'src/types/shared';

export class BookingService {
  private api: AxiosInstance;

  constructor(baseURL: string) {
    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async createBooking(payload: BookSeatsPayload): Promise<BookingResponse[]> {
    try {
      const response = await this.api.post<BookingResponse[]>('/booking', payload);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create booking');
    }
  }

  async updateBooking(bookingId: string, payload: Partial<BookSeatsPayload>): Promise<BookingResponse> {
    try {
      const response = await this.api.put<BookingResponse>(`/booking/${bookingId}`, payload);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update booking');
    }
  }

  async deleteBooking(bookingId: string): Promise<void> {
    try {
      await this.api.delete(`/booking/${bookingId}`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete booking');
    }
  }

  async getAllBookings(): Promise<BookingResponse[]> {
    try {
      const response = await this.api.get<BookingResponse[]>('/booking');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch bookings');
    }
  }

  async getBookingById(bookingId: string): Promise<BookingResponse> {
    try {
      const response = await this.api.get<BookingResponse>(`/booking/${bookingId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch booking');
    }
  }
}

export const bookingService = new BookingService('http://localhost:4000');