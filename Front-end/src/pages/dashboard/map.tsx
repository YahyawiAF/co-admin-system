"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { SeatsioSeatingChart } from "@seatsio/seatsio-react";
import type { SelectableObject, SeatingChart } from "@seatsio/seatsio-types";
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
  Snackbar,
  IconButton,
  Avatar,
  Portal,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  CardContent,
} from "@mui/material";
import DashboardLayout from "../../layouts/Dashboard";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import type { ReactElement } from "react";
import { bookingService } from "src/api/bookingservice";
import { useGetMembersQuery } from "src/api/members.repo";
import { useGetJournalQuery } from "src/api/journal.repo";
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import { BookingResponse, Member, Journal, Abonnement } from "src/types/shared";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  EventSeat as SeatIcon,
  EventAvailable as DateIcon,
  Search as SearchIcon,
  Update as RefreshIcon,
  Chair as ChairIcon,
} from "@mui/icons-material";
import { NextPage } from "next/types";
import Fuse from "fuse.js";

// Types
interface SeatSelection {
  label: string;
  category?: { key: string };
}

interface BookingWithMember extends BookingResponse {
  member?: Member;
  journal?: Journal;
  abonnement?: Abonnement;
  fullName?: string;
}

interface SeatingChartProps {
  selectedDate?: Date;
}

// Styled Components (inchangés)
const PageContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  minHeight: "calc(100vh - 64px)",
  padding: theme.spacing(3),
  backgroundColor: theme.palette.grey[100],
  position: "relative",
}));

const MainContainer = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  boxShadow: theme.shadows[3],
  flex: 1,
  backgroundColor: "#fff",
}));

const ChartContainer = styled(Card)(({ theme }) => ({
  overflow: "hidden",
  height: "500px",
  boxShadow: theme.shadows[2],
  position: "relative",
  marginBottom: theme.spacing(3),
}));

const BookingsTableContainer = styled(Card)(({ theme }) => ({
  marginTop: theme.spacing(3),
  boxShadow: theme.shadows[2],
}));

const StatsCard = styled(Card)(({ theme }) => ({
  boxShadow: theme.shadows[2],
  borderRadius: theme.shape.borderRadius,
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: theme.palette.common.white,
  transition: "transform 0.2s ease-in-out",
  "&:hover": {
    transform: "translateY(-4px)",
  },
}));

const StatsCardContent = styled(CardContent)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(2),
}));

const RectangularModal = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    borderRadius: "4px",
    width: "100%",
    maxWidth: "500px",
    margin: theme.spacing(2),
    overflow: "hidden",
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 2147483647,
  },
  "& .MuiBackdrop-root": {
    backgroundColor: "rgba(0,0,0,0.8)",
    zIndex: 2147483646,
  },
}));

const ModalHeader = styled(DialogTitle)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  padding: theme.spacing(2),
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}));

const ModalContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  "& .MuiSelect-select": {
    zIndex: 2147483648,
  },
  "& .MuiPopover-root": {
    zIndex: 2147483649,
  },
}));

const ModalFooter = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  justifyContent: "space-between",
}));

const InfoRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: theme.palette.grey[50],
  borderRadius: "4px",
}));

const InfoIconWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.main,
  borderRadius: "4px",
  width: "40px",
  height: "40px",
  marginRight: theme.spacing(2),
  flexShrink: 0,
}));

const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  "&:hover": {
    backgroundColor: theme.palette.primary.dark,
  },
  padding: theme.spacing(1, 3),
  borderRadius: "4px",
  textTransform: "none",
}));

const SecondaryButton = styled(Button)(({ theme }) => ({
  borderColor: theme.palette.grey[400],
  color: theme.palette.text.primary,
  padding: theme.spacing(1, 3),
  borderRadius: "4px",
  textTransform: "none",
  marginRight: theme.spacing(1),
}));

const MembersList = styled(List)(({ theme }) => ({
  width: "100%",
  maxHeight: "300px",
  overflowY: "auto",
  marginTop: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

const MemberListItem = styled(ListItem)(({ theme }) => ({
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&.Mui-selected": {
    backgroundColor: theme.palette.primary.light,
  },
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1),
  backgroundColor: theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
}));

const RefreshButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(2),
}));

// Options de recherche Fuse.js pour les membres
const memberSearchOptions = {
  keys: [
    { name: "firstName", weight: 0.4 },
    { name: "lastName", weight: 0.4 },
    { name: "email", weight: 0.15 },
    { name: "id", weight: 0.05 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

// Options de recherche Fuse.js pour les réservations
const bookingSearchOptions = {
  keys: [
    { name: "seatId", weight: 0.4 },
    { name: "fullName", weight: 0.4 },
    { name: "subscriptionType", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

// Fonction pour appliquer le filtre avec Fuse.js pour les membres
const applyMemberFilters = (
  members: Member[],
  searchTerm: string,
  journals: Journal[],
  abonnements: Abonnement[],
  selectedDate: Date
): Member[] => {
  // Filtrer les membres ayant un journal actif pour la date sélectionnée ou un abonnement actif
  const activeMembers = members.filter((member) => {
    const hasJournal = journals.some((j) => {
      if (j.memberID !== member.id || !j.registredTime) return false;
      const journalDate = new Date(j.registredTime);
      return (
        journalDate.getFullYear() === selectedDate.getFullYear() &&
        journalDate.getMonth() === selectedDate.getMonth() &&
        journalDate.getDate() === selectedDate.getDate() &&
        (!j.leaveTime || new Date(j.leaveTime) > new Date())
      );
    });
    const hasAbonnement = abonnements.some(
      (a) =>
        a.memberID === member.id &&
        a.registredDate &&
        (!a.leaveDate || new Date(a.leaveDate) > new Date())
    );
    return hasJournal || hasAbonnement;
  });

  // Ajouter les indicateurs hasJournal et hasAbonnement
  const enrichedMembers = activeMembers.map((member) => ({
    ...member,
    hasJournal: journals.some((j) => {
      if (j.memberID !== member.id || !j.registredTime) return false;
      const journalDate = new Date(j.registredTime);
      return (
        journalDate.getFullYear() === selectedDate.getFullYear() &&
        journalDate.getMonth() === selectedDate.getMonth() &&
        journalDate.getDate() === selectedDate.getDate() &&
        (!j.leaveTime || new Date(j.leaveTime) > new Date())
      );
    }),
    hasAbonnement: abonnements.some(
      (a) =>
        a.memberID === member.id &&
        a.registredDate &&
        (!a.leaveDate || new Date(a.leaveDate) > new Date())
    ),
  }));

  if (!searchTerm || searchTerm.length < 2) {
    return enrichedMembers;
  }

  const fuse = new Fuse(enrichedMembers, memberSearchOptions);
  const results = fuse.search(searchTerm);
  return results.map((result) => result.item);
};

// Fonction pour appliquer le filtre avec Fuse.js pour les réservations
const applyBookingFilters = (
  bookings: BookingWithMember[],
  searchTerm: string,
  selectedDate: Date
): BookingWithMember[] => {
  // Filtrer les réservations : inclure les journaux pour la date sélectionnée et tous les abonnements actifs
  const filteredBookings = bookings.filter((booking) => {
    if (booking.journal && booking.journal.registredTime) {
      const journalDate = new Date(booking.journal.registredTime);
      return (
        journalDate.getFullYear() === selectedDate.getFullYear() &&
        journalDate.getMonth() === selectedDate.getMonth() &&
        journalDate.getDate() === selectedDate.getDate() &&
        (!booking.journal.leaveTime ||
          new Date(booking.journal.leaveTime) > new Date())
      );
    }
    if (booking.abonnement && booking.abonnement.registredDate) {
      return (
        !booking.abonnement.leaveDate ||
        new Date(booking.abonnement.leaveDate) > new Date()
      );
    }
    return false;
  });

  if (!searchTerm || searchTerm.length < 2) {
    return filteredBookings;
  }

  const fuse = new Fuse(filteredBookings, bookingSearchOptions);
  const results = fuse.search(searchTerm);
  return results.map((result) => result.item);
};

const SeatingChart: NextPage<SeatingChartProps> & {
  getLayout?: (page: ReactElement) => ReactElement;
} = ({ selectedDate = new Date() }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [isBooking, setIsBooking] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingWithMember[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentSeat, setCurrentSeat] = useState<SeatSelection | null>(null);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithMember | null>(null);
  const [memberId, setMemberId] = useState<string>("");
  const [modalMode, setModalMode] = useState<"add" | "update" | "view">("add");
  const [searchTerm, setSearchTerm] = useState("");
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<SeatingChart | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [availableSeats, setAvailableSeats] = useState<number>(0);
  const [bookedSeats, setBookedSeats] = useState<number>(0);

  const {
    data: members = [],
    isLoading: isMembersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useGetMembersQuery();

  const { data: journals = { data: [] }, refetch: refetchJournals } =
    useGetJournalQuery({
      page: 0,
      perPage: 1000,
      journalDate: selectedDate.toDateString(),
    });

  const { data: abonnements = { data: [] }, refetch: refetchAbonnements } =
    useGetAbonnementsQuery({});

  useEffect(() => {
    const handleFuller = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFuller);
    return () => {
      document.removeEventListener("fullscreenchange", handleFuller);
    };
  }, []);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(checkExpiredBookings, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchBookings();
    refetchJournals();
  }, [selectedDate]);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const bookingsData = await bookingService.getAllBookings();
      const enrichedBookings = await enrichBookingsWithMemberData(bookingsData);
      // Filtrer les réservations pour les statistiques
      const filteredBookings = enrichedBookings.filter((booking) => {
        if (booking.journal && booking.journal.registredTime) {
          const journalDate = new Date(booking.journal.registredTime);
          return (
            journalDate.getFullYear() === selectedDate.getFullYear() &&
            journalDate.getMonth() === selectedDate.getMonth() &&
            journalDate.getDate() === selectedDate.getDate() &&
            (!booking.journal.leaveTime ||
              new Date(booking.journal.leaveTime) > new Date())
          );
        }
        if (booking.abonnement && booking.abonnement.registredDate) {
          return (
            !booking.abonnement.leaveDate ||
            new Date(booking.abonnement.leaveDate) > new Date()
          );
        }
        return false;
      });
      setBookings(enrichedBookings);
      const totalSeats = 46;
      setBookedSeats(filteredBookings.length);
      setAvailableSeats(totalSeats - filteredBookings.length);
    } catch (error: any) {
      setBookingError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const enrichBookingsWithMemberData = async (
    bookingsData: BookingResponse[]
  ): Promise<BookingWithMember[]> => {
    return Promise.all(
      bookingsData.map(async (booking) => {
        const member = members.find((m) => m.id === booking.memberId);
        const journal = journals.data.find(
          (j) =>
            j.memberID === booking.memberId &&
            j.registredTime &&
            (!j.leaveTime || new Date(j.leaveTime) > new Date())
        );
        const abonnement = abonnements.data.find(
          (a) =>
            a.memberID === booking.memberId &&
            a.registredDate &&
            (!a.leaveDate || new Date(a.leaveDate) > new Date())
        );
        return {
          ...booking,
          member,
          journal,
          abonnement,
          fullName: member
            ? `${member.firstName} ${member.lastName}`
            : "Unknown",
          subscriptionType: journal
            ? "Journal"
            : abonnement
            ? "Membership"
            : "Unknown",
        };
      })
    );
  };

  const checkExpiredBookings = async () => {
    const now = new Date();
    for (const booking of bookings) {
      if (
        booking.journal &&
        booking.journal.leaveTime &&
        new Date(booking.journal.leaveTime) <= now
      ) {
        await bookingService.deleteBooking(booking.id);
      }
      if (
        booking.abonnement &&
        booking.abonnement.leaveDate &&
        new Date(booking.abonnement.leaveDate) <= now
      ) {
        await bookingService.deleteBooking(booking.id);
      }
    }
    await fetchBookings();
  };

  const calculateRemainingTime = (booking: BookingWithMember): string => {
    const now = new Date();
    let endDate: Date | null = null;

    if (booking.journal && booking.journal.leaveTime) {
      endDate = new Date(booking.journal.leaveTime);
    } else if (booking.abonnement && booking.abonnement.leaveDate) {
      endDate = new Date(booking.abonnement.leaveDate);
    }

    if (!endDate) return "N/A";
    if (endDate < now) return "Expired";

    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      return `${months} month(s) ${remainingDays} day(s)`;
    } else if (diffDays >= 7) {
      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;
      return `${weeks} week(s) ${remainingDays} day(s)`;
    } else if (diffDays > 0) {
      return `${diffDays} day(s) ${diffHours} hour(s)`;
    } else {
      return `${diffHours} hour(s) ${diffMinutes} minute(s)`;
    }
  };

  const handleObjectClicked = useCallback(
    async (object: SelectableObject) => {
      if (chartRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const seat = {
        label: object.label,
        category: object.category
          ? { key: String((object.category as { key: string | number }).key) }
          : undefined,
      };
      setCurrentSeat(seat);
      setBookingError(null);

      const booking = bookings.find((b) => b.seatId === seat.label);
      if (booking) {
        try {
          const fetchedBooking = await bookingService.getBookingById(
            booking.id
          );
          const enrichedBooking = (
            await enrichBookingsWithMemberData([fetchedBooking])
          )[0];
          setSelectedBooking(enrichedBooking);
          setMemberId(fetchedBooking.memberId || "");
          setModalMode("view");
        } catch (error: any) {
          setBookingError(error.message);
          return;
        }
      } else {
        setSelectedBooking(null);
        setMemberId("");
        setModalMode("add");
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
      eventKey: "180346ed-b27d-4677-8975-f4b168d98cc0",
      seats: [currentSeat.label],
      memberId,
    };

    try {
      if (modalMode === "update" && selectedBooking) {
        if (!selectedBooking.id) throw new Error("Invalid booking ID");
        await bookingService.deleteBooking(selectedBooking.id);
        await bookingService.createBooking(payload);
        setBookingSuccess("Booking updated successfully!");
      } else {
        await bookingService.createBooking(payload);
        setBookingSuccess("Booking created successfully!");
      }

      setShowModal(false);
      setCurrentSeat(null);
      setMemberId("");
      setSelectedBooking(null);
      await fetchBookings();
    } catch (error: any) {
      const errorMessage = error.message.includes("suggestion")
        ? `${error.message.split("suggestion")[0]} - Suggestion: ${
            error.message.split("suggestion")[1]
          }`
        : error.message;
      setBookingError(errorMessage);
      await fetchBookings();
    } finally {
      setIsBooking(false);
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking?.id) {
      setBookingError("Invalid booking ID");
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      await bookingService.deleteBooking(selectedBooking.id);
      setBookingSuccess("Booking deleted successfully!");
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
    setModalMode("update");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentSeat(null);
    setSelectedBooking(null);
    setMemberId("");
    setModalMode("add");
    if (chartRef.current) {
      chartRef.current.clearSelection();
    }
  };

  const handleCloseSnackbar = () => {
    setBookingSuccess(null);
    setBookingError(null);
  };

  const getMemberName = (id: string) => {
    const member = members.find((m) => m.id === id);
    return member ? `${member.firstName} ${member.lastName}` : "Unknown";
  };

  // Filtrage des membres avec Fuse.js
  const filteredMembers = applyMemberFilters(
    members,
    searchTerm,
    journals.data,
    abonnements.data,
    selectedDate
  );

  // Filtrage des réservations avec Fuse.js
  const filteredBookings = applyBookingFilters(
    bookings,
    tableSearchTerm,
    selectedDate
  );

  const handleRefresh = async () => {
    await Promise.all([
      fetchBookings(),
      refetchMembers(),
      refetchJournals(),
      refetchAbonnements(),
    ]);
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleString();
    } catch (e) {
      return "Invalid date";
    }
  };

  return (
    <PageContainer>
      <Typography
        variant="h4"
        sx={{ mb: 3, fontWeight: "bold", color: theme.palette.text.primary }}
      >
        Coworking Space Booking
      </Typography>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6}>
          <StatsCard>
            <StatsCardContent>
              <ChairIcon sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h6" component="div">
                  Booked Spaces
                </Typography>
                <Typography variant="h4" component="div">
                  {bookedSeats}
                </Typography>
              </Box>
            </StatsCardContent>
          </StatsCard>
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatsCard>
            <StatsCardContent>
              <ChairIcon sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h6" component="div">
                  Available Spaces
                </Typography>
                <Typography variant="h4" component="div">
                  {availableSeats}
                </Typography>
              </Box>
            </StatsCardContent>
          </StatsCard>
        </Grid>
      </Grid>

      <MainContainer>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Seating Map</Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>

        <ChartContainer>
          <SeatsioSeatingChart
            workspaceKey="f1e63d51-d4b8-4993-ab7c-345a9904a899"
            event="180346ed-b27d-4677-8975-f4b168d98cc0"
            region="sa"
            onObjectClicked={handleObjectClicked}
            onChartRendered={(chart) => {
              chartRef.current = chart;
              setChartError(null);
            }}
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
              return "Available";
            }}
            messages={{
              notAvailable: "Booked",
              available: "Available",
            }}
          />
        </ChartContainer>

        <BookingsTableContainer>
          <Box p={2}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={2}
            >
              <Typography variant="h6">Current Reservations</Typography>
              <SearchContainer sx={{ width: "300px" }}>
                <SearchIcon color="action" sx={{ mr: 1 }} />
                <TextField
                  fullWidth
                  variant="standard"
                  placeholder="Search bookings..."
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  InputProps={{
                    disableUnderline: true,
                  }}
                />
              </SearchContainer>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Seat</TableCell>
                    <TableCell>Member</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Registered</TableCell>
                    <TableCell>Leave</TableCell>
                    <TableCell>Remaining Time</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No matching reservations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>{booking.seatId}</TableCell>
                        <TableCell>
                          {booking.member
                            ? `${booking.member.firstName} ${booking.member.lastName}`
                            : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              booking.journal
                                ? "Journal"
                                : booking.abonnement
                                ? "Membership"
                                : "Unknown"
                            }
                            color={booking.journal ? "primary" : "secondary"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {formatDate(
                            booking.journal?.registredTime ||
                              booking.abonnement?.registredDate
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(
                            booking.journal?.leaveTime ||
                              booking.abonnement?.leaveDate
                          )}
                        </TableCell>
                        <TableCell>{calculateRemainingTime(booking)}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                const fetchedBooking =
                                  await bookingService.getBookingById(
                                    booking.id
                                  );
                                const enrichedBooking = (
                                  await enrichBookingsWithMemberData([
                                    fetchedBooking,
                                  ])
                                )[0];
                                setSelectedBooking(enrichedBooking);
                                setCurrentSeat({ label: booking.seatId });
                                setMemberId(fetchedBooking.memberId || "");
                                setModalMode("view");
                                setShowModal(true);
                              } catch (error: any) {
                                setBookingError(error.message);
                              }
                            }}
                          >
                            <PersonIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                await bookingService.deleteBooking(booking.id);
                                setBookingSuccess(
                                  "Booking deleted successfully!"
                                );
                                await fetchBookings();
                              } catch (error: any) {
                                setBookingError(error.message);
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" color="error" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </BookingsTableContainer>

        <Portal container={document.body}>
          <RectangularModal
            open={showModal}
            onClose={handleCloseModal}
            fullWidth
            maxWidth="sm"
            disableEnforceFocus
            disablePortal
            style={{
              zIndex: 2147483647,
              position: isFullscreen ? "fixed" : "static",
            }}
          >
            <ModalHeader>
              <Box display="flex" alignItems="center">
                {modalMode === "add" ? (
                  <CheckCircleIcon
                    sx={{ mr: 1, color: theme.palette.common.white }}
                  />
                ) : modalMode === "update" ? (
                  <EditIcon sx={{ mr: 1, color: theme.palette.common.white }} />
                ) : (
                  <PersonIcon
                    sx={{ mr: 1, color: theme.palette.common.white }}
                  />
                )}
                <Typography
                  variant="h6"
                  component="div"
                  sx={{ color: theme.palette.common.white }}
                >
                  {modalMode === "add"
                    ? "Book Seat"
                    : modalMode === "update"
                    ? "Update Booking"
                    : "Booking Details"}
                </Typography>
              </Box>
              <IconButton
                onClick={handleCloseModal}
                size="small"
                sx={{ color: theme.palette.common.white }}
              >
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
                  <Typography variant="body1">{currentSeat?.label}</Typography>
                </Box>
              </InfoRow>

              {modalMode === "view" && selectedBooking && (
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
                        {selectedBooking.member
                          ? `${selectedBooking.member.firstName} ${selectedBooking.member.lastName}`
                          : "Unknown"}
                      </Typography>
                    </Box>
                  </InfoRow>
                  <InfoRow>
                    <InfoIconWrapper>
                      <DateIcon />
                    </InfoIconWrapper>
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        Registered
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(
                          selectedBooking.journal?.registredTime ||
                            selectedBooking.abonnement?.registredDate
                        )}
                      </Typography>
                    </Box>
                  </InfoRow>
                  <InfoRow>
                    <InfoIconWrapper>
                      <DateIcon />
                    </InfoIconWrapper>
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        Leave
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(
                          selectedBooking.journal?.leaveTime ||
                            selectedBooking.abonnement?.leaveDate
                        )}
                      </Typography>
                    </Box>
                  </InfoRow>
                  <InfoRow>
                    <InfoIconWrapper>
                      <DateIcon />
                    </InfoIconWrapper>
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        Remaining Time
                      </Typography>
                      <Typography variant="body1">
                        {calculateRemainingTime(selectedBooking)}
                      </Typography>
                    </Box>
                  </InfoRow>
                  <InfoRow>
                    <InfoIconWrapper>
                      {selectedBooking.journal ? <PersonIcon /> : <DateIcon />}
                    </InfoIconWrapper>
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        Subscription Type
                      </Typography>
                      <Typography variant="body1">
                        {selectedBooking.journal
                          ? "Journal"
                          : selectedBooking.abonnement
                          ? "Membership"
                          : "Unknown"}
                      </Typography>
                    </Box>
                  </InfoRow>
                </>
              )}

              {(modalMode === "add" || modalMode === "update") && (
                <Box>
                  <SearchContainer>
                    <SearchIcon color="action" sx={{ mr: 1 }} />
                    <TextField
                      fullWidth
                      variant="standard"
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        disableUnderline: true,
                      }}
                    />
                  </SearchContainer>

                  <MembersList>
                    {isMembersLoading ? (
                      <Box display="flex" justifyContent="center" p={2}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : filteredMembers.length === 0 ? (
                      <ListItem>
                        <ListItemText primary="No members with active journal entries for this date or active memberships" />
                      </ListItem>
                    ) : (
                      filteredMembers.map((member) => (
                        <Box key={member.id}>
                          <MemberListItem
                            selected={memberId === member.id}
                            onClick={() => setMemberId(member.id)}
                          >
                            <ListItemAvatar>
                              <Avatar
                                sx={{
                                  backgroundColor: theme.palette.primary.light,
                                  color: theme.palette.primary.main,
                                }}
                              >
                                {member.firstName?.charAt(0)}
                                {member.lastName?.charAt(0)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={`${member.firstName} ${member.lastName}`}
                              secondary={
                                <Box
                                  component="span"
                                  sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                  }}
                                >
                                  {member.email}
                                  <Box
                                    sx={{ display: "flex", gap: 1, mt: 0.5 }}
                                  >
                                    {member.hasJournal && (
                                      <Chip
                                        label="Journal"
                                        color="primary"
                                        size="small"
                                      />
                                    )}
                                    {member.hasAbonnement && (
                                      <Chip
                                        label="Membership"
                                        color="secondary"
                                        size="small"
                                      />
                                    )}
                                  </Box>
                                </Box>
                              }
                            />
                          </MemberListItem>
                          <Divider variant="inset" component="li" />
                        </Box>
                      ))
                    )}
                  </MembersList>
                </Box>
              )}
            </ModalContent>

            <ModalFooter>
              {modalMode === "view" ? (
                <>
                  <Box sx={{ display: "flex", width: "100%" }}>
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
                  <SecondaryButton
                    onClick={handleCloseModal}
                    startIcon={<CloseIcon />}
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={handleBookSeat}
                    disabled={isBooking || !memberId || isMembersLoading}
                    startIcon={
                      isBooking ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <CheckCircleIcon />
                      )
                    }
                  >
                    {modalMode === "update" ? "Update" : "Confirm"}
                  </PrimaryButton>
                </>
              )}
            </ModalFooter>
          </RectangularModal>
        </Portal>

        <Snackbar
          open={!!bookingSuccess}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            severity="success"
            onClose={handleCloseSnackbar}
            icon={<CheckCircleIcon fontSize="inherit" />}
          >
            {bookingSuccess}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!bookingError}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error" onClose={handleCloseSnackbar}>
            {bookingError?.split("- Suggestion:")[0]}
            {bookingError?.includes("Suggestion:") && (
              <>
                <br />
                <strong>Suggestion:</strong>{" "}
                {bookingError.split("Suggestion:")[1]}
              </>
            )}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!chartError}
          autoHideDuration={6000}
          onClose={() => setChartError(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error" onClose={() => setChartError(null)}>
            Chart loading error: {chartError}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!membersError}
          autoHideDuration={6000}
          onClose={() => {}}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error">Members loading error.</Alert>
        </Snackbar>
      </MainContainer>
    </PageContainer>
  );
};

SeatingChart.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default SeatingChart;
