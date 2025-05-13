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
  IconButton,
  Avatar,
  Divider,
} from '@mui/material';
import DashboardLayout from '../../layouts/Dashboard';
import RoleProtectedRoute from 'src/components/auth/ProtectedRoute';
import type { ReactElement } from 'react';
import { bookingService } from 'src/api/bookingservice';
import { useGetMembersQuery } from 'src/api/members.repo';
import { BookingResponse } from 'src/types/shared';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  EventSeat as SeatIcon,
  EventAvailable as DateIcon,
} from '@mui/icons-material';

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

const RectangularModal = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '4px', // Bordes droits pour un look rectangulaire
    width: '100%',
    maxWidth: '500px',
    margin: theme.spacing(2),
    overflow: 'hidden',
  },
}));

const ModalHeader = styled(DialogTitle)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}));

const ModalContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
}));

const ModalFooter = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  justifyContent: 'space-between',
}));

const InfoRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: theme.palette.grey[50],
  borderRadius: '4px',
}));

const InfoIconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.main,
  borderRadius: '4px',
  width: '40px',
  height: '40px',
  marginRight: theme.spacing(2),
  flexShrink: 0,
}));

const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
  padding: theme.spacing(1, 3),
  borderRadius: '4px',
  textTransform: 'none',
}));

const SecondaryButton = styled(Button)(({ theme }) => ({
  borderColor: theme.palette.grey[400],
  color: theme.palette.text.primary,
  padding: theme.spacing(1, 3),
  borderRadius: '4px',
  textTransform: 'none',
  marginRight: theme.spacing(1),
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

  const getMemberName = (id: string) => {
    const member = members.find((m) => m.id === id);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: theme.palette.text.primary }}>
        Coworking Space Booking
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
              if (booking && booking.memberId) {
                return `Member: ${getMemberName(booking.memberId)}`;
              }
              return '';
            }}
            messages={{
              notAvailable: 'Booked',
            }}
          />
        </ChartContainer>

        {/* Booking Modal - Version Rectangulaire */}
        <RectangularModal
          open={showModal}
          onClose={handleCloseModal}
          fullWidth
          maxWidth="sm"
        >
          <ModalHeader>
            <Box display="flex" alignItems="center">
              {modalMode === 'add' ? (
                <CheckCircleIcon sx={{ mr: 1, color: theme.palette.common.white }} />
              ) : modalMode === 'update' ? (
                <EditIcon sx={{ mr: 1, color: theme.palette.common.white }} />
              ) : (
                <PersonIcon sx={{ mr: 1, color: theme.palette.common.white }} />
              )}
              <Typography variant="h6" component="div" sx={{ color: theme.palette.common.white }}>
                {modalMode === 'add' ? 'Book Seat' : modalMode === 'update' ? 'Update Booking' : 'Booking Details'}
              </Typography>
            </Box>
            <IconButton onClick={handleCloseModal} size="small" sx={{ color: theme.palette.common.white }}>
              <CloseIcon />
            </IconButton>
          </ModalHeader>

          <ModalContent>
            <InfoRow>
              <InfoIconWrapper>
                <SeatIcon />
              </InfoIconWrapper>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Seat Number
                </Typography>
                <Typography variant="body1">
                  {currentSeat?.label}
                </Typography>
              </Box>
            </InfoRow>

            {modalMode === 'view' && selectedBooking && (
              <>
                <InfoRow>
                  <InfoIconWrapper>
                    <PersonIcon />
                  </InfoIconWrapper>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Member
                    </Typography>
                    <Typography variant="body1">
                      {getMemberName(selectedBooking.memberId || '')}
                    </Typography>
                  </Box>
                </InfoRow>
                <InfoRow>
                  <InfoIconWrapper>
                    <DateIcon />
                  </InfoIconWrapper>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Booking Date
                    </Typography>
                    <Typography variant="body1">
                      {selectedBooking.createdAt ? new Date(selectedBooking.createdAt).toLocaleString() : 'N/A'}
                    </Typography>
                  </Box>
                </InfoRow>
              </>
            )}

            {(modalMode === 'add' || modalMode === 'update') && (
              <FormControl fullWidth sx={{ mt: 2 }} disabled={isBooking || isMembersLoading}>
                <InputLabel id="member-select-label">Select Member</InputLabel>
                <Select
                  labelId="member-select-label"
                  value={memberId}
                  label="Select Member"
                  onChange={(e) => setMemberId(e.target.value as string)}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  }}
                >
                  {members.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ width: 24, height: 24, mr: 2, fontSize: '0.75rem' }}>
                          {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                        </Avatar>
                        {member.firstName} {member.lastName}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </ModalContent>

          <ModalFooter>
            {modalMode === 'view' ? (
              <>
                <Box sx={{ display: 'flex', width: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <IconButton
                      onClick={handleSwitchToUpdate}
                      disabled={isBooking}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>

                  <IconButton
                    onClick={handleDeleteBooking}
                    disabled={isBooking}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </>
            ) : (
              <>
                <SecondaryButton onClick={handleCloseModal} startIcon={<CloseIcon />}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={handleBookSeat}
                  disabled={isBooking || !memberId || isMembersLoading}
                  startIcon={isBooking ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                >
                  {modalMode === 'update' ? 'Update' : 'Confirm'}
                </PrimaryButton>
              </>
            )}
          </ModalFooter>
        </RectangularModal>

        <Snackbar
          open={!!bookingSuccess}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" onClose={handleCloseSnackbar} icon={<CheckCircleIcon fontSize="inherit" />}>
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