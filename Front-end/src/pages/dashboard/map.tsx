'use client';
import { useState, useCallback, useEffect } from 'react';
import { SeatsioSeatingChart } from '@seatsio/seatsio-react';
import type { SelectableObject } from '@seatsio/seatsio-types';
import {
  Box,
  Paper,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Alert,
  styled,
  Card,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
} from '@mui/material';
import DashboardLayout from '../../layouts/Dashboard';
import RoleProtectedRoute from 'src/components/auth/ProtectedRoute';
import type { ReactElement } from 'react';
import { bookingService } from 'src/api/bookingservice';
import { useGetMembersQuery } from 'src/api/members.repo';
import { BookingResponse } from 'src/types/shared';

// Types
interface SeatSelection {
  label: string;
  category?: { key: string };
}

// Styled Components
const PageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 'calc(100vh - 64px)',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.grey[100],
}));

const MainContainer = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  boxShadow: theme.shadows[3],
  flex: 1,
  backgroundColor: '#fff',
}));

const ChartContainer = styled(Card)(({ theme }) => ({
  overflow: 'hidden',
  height: '500px',
  boxShadow: theme.shadows[2],
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#054547',
  color: '#fff',
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: '#033a3b',
  },
  '&:disabled': {
    backgroundColor: theme.palette.grey[400],
  },
}));

// Main Component
function SeatingChart() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentSeat, setCurrentSeat] = useState<SeatSelection | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingResponse | null>(null);
  const [memberId, setMemberId] = useState<string>('');
  const [modalMode, setModalMode] = useState<'add' | 'update' | 'view'>('add');

  const { data: members = [], isLoading: isMembersLoading, error: membersError } = useGetMembersQuery();

  // Fetch bookings
  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const bookings = await bookingService.getAllBookings();
      setBookings(bookings);
    } catch (error: any) {
      setBookingError(error.message);
    }
  };

  const handleObjectClicked = useCallback(
    async (object: SelectableObject) => {
      const seat = {
        label: object.label,
        category: object.category ? { key: String((object.category as { key: string | number }).key) } : undefined,
      };
      setCurrentSeat(seat);
      setBookingError(null);

      // Check if the seat is booked
      const booking = bookings.find((b) => b.seatId === seat.label);
      if (booking) {
        // Reserved seat: Show view/update modal
        try {
          const fetchedBooking = await bookingService.getBookingById(booking.id);
          setSelectedBooking(fetchedBooking);
          setMemberId(fetchedBooking.memberId || '');
          setModalMode('view');
        } catch (error: any) {
          setBookingError(error.message);
          return;
        }
      } else {
        // Free seat: Show add booking modal
        setSelectedBooking(null);
        setMemberId('');
        setModalMode('add');
      }
      setShowModal(true);
    },
    [bookings]
  );

  const handleBookSeat = async () => {
    if (!currentSeat || !memberId) return;

    setIsBooking(true);
    setBookingError(null);

    const payload = {
      eventKey: '180346ed-b27d-4677-8975-f4b168d98cc0',
      seats: [currentSeat.label],
      memberId,
    };

    try {
      if (modalMode === 'update' && selectedBooking) {
        if (!selectedBooking.id) throw new Error('Invalid booking ID');
        await bookingService.deleteBooking(selectedBooking.id);
        await bookingService.createBooking(payload);
        setBookingSuccess('Booking updated successfully!');
      } else {
        await bookingService.createBooking(payload);
        setBookingSuccess('Booking created successfully!');
      }

      setShowModal(false);
      setCurrentSeat(null);
      setMemberId('');
      setSelectedBooking(null);
      await fetchBookings();
    } catch (error: any) {
      const errorMessage = error.message.includes('suggestion')
        ? `${error.message.split('suggestion')[0]} - Suggestion: ${error.message.split('suggestion')[1]}`
        : error.message;
      setBookingError(errorMessage);
      await fetchBookings();
    } finally {
      setIsBooking(false);
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking?.id) {
      setBookingError('Invalid booking ID');
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      await bookingService.deleteBooking(selectedBooking.id);
      setBookingSuccess('Booking deleted successfully!');
      setShowModal(false);
      setCurrentSeat(null);
      setSelectedBooking(null);
      await fetchBookings();
    } catch (error: any) {
      setBookingError(error.message);
    } finally {
      setIsBooking(false);
    }
  };

  const handleSwitchToUpdate = () => {
    setModalMode('update');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentSeat(null);
    setSelectedBooking(null);
    setMemberId('');
    setModalMode('add');
  };

  const handleCloseSnackbar = () => {
    setBookingSuccess(null);
    setBookingError(null);
  };

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: theme.palette.text.primary }}>
        Coworking space booking
      </Typography>

      <MainContainer>
        <ChartContainer>
          <SeatsioSeatingChart
            workspaceKey="f1e63d51-d4b8-4993-ab7c-345a9904a899"
            event="180346ed-b27d-4677-8975-f4b168d98cc0"
            region="sa"
            onObjectClicked={handleObjectClicked}
            onChartRendered={() => setChartError(null)}
            colors={{
              colorSelected: theme.palette.primary.main,
              availableObjectColor: theme.palette.grey[200],
              errorColor: theme.palette.error.main,
            }}
            showLegend={true}
            language="en"
            tooltipInfo={(object: SelectableObject) => {
              const booking = bookings.find((b) => b.seatId === object.label);
              let memberName: string | null = null;
              if (booking && booking.memberId) {
                const member = members.find((m) => m.id === booking.memberId);
                memberName = member && member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : null;
              }
              if (memberName) {
                return `Member: ${memberName}`;
              }
              return '';
            }}
            messages={{
              notAvailable: 'Booked',
            }}
          />
        </ChartContainer>

        {/* Booking Modal */}
        <Dialog open={showModal} onClose={handleCloseModal}>
          <DialogTitle>
            {modalMode === 'add' ? 'Book Seat' : modalMode === 'update' ? 'Update Booking' : 'View Booking'}
          </DialogTitle>
          <DialogContent>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Seat: {currentSeat?.label}
            </Typography>
            {modalMode === 'view' && selectedBooking && (
              <>
                <Typography sx={{ mb: 2 }}>
                  Member:{' '}
                  {members.find((m) => m.id === selectedBooking.memberId)?.firstName
                    ? `${members.find((m) => m.id === selectedBooking.memberId)?.firstName} ${members.find((m) => m.id === selectedBooking.memberId)?.lastName
                    }`
                    : 'Unknown'}
                </Typography>
                <Typography sx={{ mb: 2 }}>
                  Date: {selectedBooking.createdAt ? new Date(selectedBooking.createdAt).toLocaleString() : ''}
                </Typography>
              </>
            )}
            {(modalMode === 'add' || modalMode === 'update') && (
              <FormControl fullWidth sx={{ mb: 2 }} disabled={isBooking || isMembersLoading}>
                <InputLabel id="member-select-label">Member</InputLabel>
                <Select
                  labelId="member-select-label"
                  value={memberId}
                  label="Member"
                  onChange={(e) => setMemberId(e.target.value as string)}
                >
                  {members.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            {modalMode === 'view' && (
              <>
                <Button onClick={handleSwitchToUpdate} disabled={isBooking}>
                  Edit
                </Button>
                <SubmitButton onClick={handleDeleteBooking} disabled={isBooking}>
                  {isBooking ? <CircularProgress size={24} color="inherit" /> : 'Delete'}
                </SubmitButton>
              </>
            )}
            {(modalMode === 'add' || modalMode === 'update') && (
              <SubmitButton onClick={handleBookSeat} disabled={isBooking || !memberId || isMembersLoading}>
                {isBooking ? (
                  <CircularProgress size={24} color="inherit" />
                ) : modalMode === 'update' ? (
                  'Update'
                ) : (
                  'Confirm'
                )}
              </SubmitButton>
            )}
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!bookingSuccess}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" onClose={handleCloseSnackbar}>
            {bookingSuccess}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!bookingError}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={handleCloseSnackbar}>
            {bookingError?.split('- Suggestion:')[0]}
            {bookingError?.includes('Suggestion:') && (
              <>
                <br />
                <strong>Suggestion:</strong> {bookingError.split('Suggestion:')[1]}
              </>
            )}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!chartError}
          autoHideDuration={6000}
          onClose={() => setChartError(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setChartError(null)}>
            Chart loading error: {chartError}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!membersError}
          autoHideDuration={6000}
          onClose={() => { }}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error">Members loading error.</Alert>
        </Snackbar>
      </MainContainer>
    </PageContainer>
  );
}

// Layout with Role Protection
SeatingChart.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={['ADMIN']}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default SeatingChart;