'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { SeatsioSeatingChart } from '@seatsio/seatsio-react';
import type { SelectableObject } from '@seatsio/seatsio-types';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Alert,
  styled,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
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

interface Pricing {
  category: string;
  price: number;
  label?: string;
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
  marginBottom: theme.spacing(3),
  overflow: 'hidden',
  height: '500px',
  boxShadow: theme.shadows[2],
}));

const BookingPanel = styled(Card)(({ theme }) => ({
  backgroundColor: '#f9fafb',
  marginBottom: theme.spacing(3),
  position: 'sticky',
  top: theme.spacing(2),
  zIndex: 1,
  boxShadow: theme.shadows[2],
}));

const BookingsList = styled(Card)(({ theme }) => ({
  backgroundColor: '#f9fafb',
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

const ActionButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.grey[600],
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

// Main Component
function SeatingChart() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedSeats, setSelectedSeats] = useState<SeatSelection[]>([]);
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingResponse | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('');

  const { data: members = [], isLoading: isMembersLoading, error: membersError } = useGetMembersQuery();

  const pricing: Pricing[] = [
    { category: '1', price: 20, label: 'Standard' },
    { category: '2', price: 30, label: 'Premium' },
  ];

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

  const handleObjectSelected = useCallback((object: SelectableObject) => {
    if (object.selectable) {
      setSelectedSeats((prev) => [
        ...prev,
        {
          label: object.label,
          category: object.category
            ? { key: String((object.category as { key: string | number }).key) }
            : undefined,
        },
      ]);
      setBookingError(null);
    }
  }, []);

  const handleObjectDeselected = useCallback((object: SelectableObject) => {
    setSelectedSeats((prev) => prev.filter((seat) => seat.label !== object.label));
  }, []);

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((sum, seat) => {
      const seatCategory = seat.category?.key || '1';
      const priceInfo = pricing.find((p) => p.category === seatCategory);
      return sum + (priceInfo?.price || 0);
    }, 0);
  }, [selectedSeats, pricing]);
  const confirmUpdate = async () => {
    if (window.confirm('Are you sure you want to update this booking? The old seat will be released and the new one will be booked.')) {
      await handleBookSeats();
    }
  };

  // Dans le JSX, remplacez onClick={handleBookSeats} par onClick={confirmUpdate}

  const handleBookSeats = async () => {
    if (selectedSeats.length === 0 || !memberId) return;

    setIsBooking(true);
    setBookingError(null);

    const payload = {
      eventKey: '180346ed-b27d-4677-8975-f4b168d98cc0',
      seats: selectedSeats.map((seat) => seat.label),
      memberId,
    };

    try {
      if (isEditing && selectedBooking) {
        if (!selectedBooking.id) {
          throw new Error('Invalid booking ID');
        }

        // Étape 1: Supprimer l'ancienne réservation
        await bookingService.deleteBooking(selectedBooking.id);

        // Étape 2: Créer une nouvelle réservation avec les nouveaux sièges
        const response = await bookingService.createBooking(payload);

        setBookingSuccess('Booking updated successfully!');
        setIsEditing(false);
        setSelectedBooking(null);
      } else {
        const response = await bookingService.createBooking(payload);
        setBookingSuccess('Booking created successfully!');
      }

      setSelectedSeats([]);
      setMemberId('');
      await fetchBookings();
    } catch (error: any) {
      const errorMessage = error.message.includes('suggestion')
        ? `${error.message.split('suggestion')[0]} - Suggestion: ${error.message.split('suggestion')[1]}`
        : error.message;
      setBookingError(errorMessage);

      // En cas d'échec, recharger les réservations pour s'assurer que l'état est cohérent
      await fetchBookings();
    } finally {
      setIsBooking(false);
    }
  };

  const handleViewBooking = async (bookingId: string) => {
    if (!bookingId) {
      setBookingError('Invalid booking ID');
      return;
    }

    try {
      const booking = await bookingService.getBookingById(bookingId);
      setSelectedBooking(booking);
      setBookingError(null);
    } catch (error: any) {
      setBookingError(error.message);
    }
  };

  const handleEditBooking = (booking: BookingResponse) => {
    if (!booking.id) {
      setBookingError('Invalid booking ID');
      return;
    }

    setSelectedBooking(booking);
    setSelectedSeats([
      {
        label: booking.seatId,
        category: { key: '1' },
      },
    ]);
    setMemberId(booking.memberId || '');
    setIsEditing(true);
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!bookingId) {
      setBookingError('Invalid booking ID');
      return;
    }

    try {
      await bookingService.deleteBooking(bookingId);
      setBookingSuccess('Booking deleted successfully!');
      await fetchBookings();
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking(null);
      }
    } catch (error: any) {
      setBookingError(error.message);
    }
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
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <ChartContainer>
              <SeatsioSeatingChart
                workspaceKey="f1e63d51-d4b8-4993-ab7c-345a9904a899"
                event="180346ed-b27d-4677-8975-f4b168d98cc0"
                region="sa"
                onObjectSelected={handleObjectSelected}
                onObjectDeselected={handleObjectDeselected}
                onChartRendered={() => setChartError(null)}
                colors={{
                  colorSelected: theme.palette.primary.main,
                  availableObjectColor: theme.palette.grey[200],
                  errorColor: theme.palette.error.main,
                }}
                showLegend={true}
                language="en"
                pricing={pricing}
                priceFormatter={(price: number) => `${price} €`}
                tooltipInfo={(object: SelectableObject) => {
                  const category = object.category?.key || '1';
                  const priceInfo = pricing.find((p) => p.category === category);
                  return `${object.label} - ${priceInfo?.label || 'Standard'}: ${priceInfo?.price || 0}€`;
                }}
                messages={{
                  notAvailable: 'Booked',
                }}
              />
            </ChartContainer>
          </Grid>

          <Grid item xs={12}>
            <BookingPanel>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
                  {isEditing ? 'Edit booking' : 'Your selection'}
                </Typography>

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
                        {member.firstName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {isMembersLoading && (
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Loading members...
                  </Typography>
                )}

                {selectedSeats.length > 0 ? (
                  <>
                    <List dense>
                      {selectedSeats.map((seat) => {
                        const category = seat.category?.key || '1';
                        const priceInfo = pricing.find((p) => p.category === category);
                        return (
                          <ListItem key={seat.label}>
                            <ListItemText
                              primary={`Seat ${seat.label} (${priceInfo?.label || 'Standard'})`}
                              secondary={`${priceInfo?.price || 0}€`}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Total: {totalPrice}€
                      </Typography>
                      <SubmitButton
                        onClick={handleBookSeats}
                        disabled={isBooking || !memberId || isMembersLoading}
                        sx={{ minWidth: isMobile ? '100%' : '200px' }}
                      >
                        {isBooking ? (
                          <CircularProgress size={24} color="inherit" />
                        ) : isEditing ? (
                          'Update'
                        ) : (
                          'Confirm'
                        )}
                      </SubmitButton>
                    </Box>
                  </>
                ) : (
                  <Typography color="text.secondary">Select seats on the chart.</Typography>
                )}
              </CardContent>
            </BookingPanel>
          </Grid>

          <Grid item xs={12}>
            <BookingsList>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
                  All bookings
                </Typography>
                {bookings.length > 0 ? (
                  <List dense>
                    {bookings.map((booking) => {
                      const member = members.find((m) => m.id === booking.memberId);
                      return (
                        <ListItem key={booking.id} divider>
                          <ListItemText
                            primary={`Booking ${booking.seatId}`}
                            secondary={`Seat: ${booking.seatId} | Member: ${member ? member.firstName : booking.memberId || 'Unknown'}`}
                          />
                          <ListItemSecondaryAction>
                            <ActionButton onClick={() => handleViewBooking(booking.id)}>
                              <VisibilityIcon />
                            </ActionButton>
                            <ActionButton onClick={() => handleEditBooking(booking)}>
                              <EditIcon />
                            </ActionButton>
                            <ActionButton onClick={() => handleDeleteBooking(booking.id)}>
                              <DeleteIcon />
                            </ActionButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Typography color="text.secondary">No bookings found.</Typography>
                )}

                {selectedBooking && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>
                      Booking details
                    </Typography>
                    <Typography>Date: {selectedBooking.createdAt ? new Date(selectedBooking.createdAt).toLocaleString() : ''}</Typography>
                    <Typography>Seat: {selectedBooking.seatId}</Typography>
                    <Typography>
                      Member:{' '}
                      {members.find((m) => m.id === selectedBooking.memberId)?.firstName ||
                        selectedBooking.memberId || 'Unknown'}
                    </Typography>
                  </>
                )}
              </CardContent>
            </BookingsList>
          </Grid>
        </Grid>

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