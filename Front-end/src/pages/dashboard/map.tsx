"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  tableId: number;
  chairId: number;
}

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

interface SeatingChartProps {
  selectedDate?: Date;
}

// Styled Components
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

const SpaceMapContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: 700,
  margin: "0 auto",
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[3],
}));

const SpaceMap = styled(Box, {
  shouldForwardProp: (prop) => prop !== "spaceType",
})<{ spaceType: string }>(({ theme, spaceType }) => ({
  position: "relative",
  width: 700,
  height: 350,
  border: `2px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor:
    spaceType === "generalSpace"
      ? "rgba(0, 150, 255, 0.05)"
      : spaceType === "openSpace"
      ? "rgba(255, 0, 0, 0.05)"
      : "rgba(0, 255, 0, 0.05)",
  backgroundImage: `linear-gradient(${theme.palette.divider} 1px, transparent 1px), linear-gradient(90deg, ${theme.palette.divider} 1px, transparent 1px)`,
  backgroundSize: "20px 20px",
  overflow: "hidden",
  padding: theme.spacing(1.5),
}));

const TableStyled = styled(Box)(({ theme }) => ({
  position: "absolute",
  backgroundColor: theme.palette.grey[500],
  borderRadius: 6,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  boxShadow: theme.shadows[4],
  border: `1px solid ${theme.palette.grey[600]}`,
}));

const Chair = styled(Box)(
  ({
    theme,
    isAvailable,
    isSelected,
  }: {
    theme: any;
    isAvailable: boolean;
    isSelected: boolean;
  }) => ({
    width: 22,
    height: 22,
    borderRadius: "50%",
    backgroundColor: isSelected
      ? theme.palette.primary.main
      : isAvailable
      ? theme.palette.success.main
      : theme.palette.error.main,
    border: `2px solid ${theme.palette.common.white}`,
    cursor: isAvailable ? "pointer" : "not-allowed",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: isAvailable ? "scale(1.2)" : "none",
      boxShadow: isAvailable ? theme.shadows[4] : "none",
    },
  })
);

const LegendItem = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const LegendDot = styled(Box)(
  ({ theme, color }: { theme: any; color: string }) => ({
    width: 14,
    height: 14,
    borderRadius: "50%",
    backgroundColor: color,
    border: `1px solid ${theme.palette.common.white}`,
  })
);

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

// Search options for Fuse.js
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

const bookingSearchOptions = {
  keys: [
    { name: "seatId", weight: 0.4 },
    { name: "fullName", weight: 0.4 },
    { name: "subscriptionTypes.type", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

// Define spaces with their tables and chairs, including positions
const initialSpaces = {
  generalSpace: {
    tables: [
      {
        id: 1,
        width: 120,
        height: 200,
        top: 20,
        left: 500,
        chairs: Array(10)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 2,
        width: 60,
        height: 80,
        top: 20,
        left: 80,
        chairs: Array(2)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 3,
        width: 60,
        height: 80,
        top: 120,
        left: 80,
        chairs: Array(2)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 4,
        width: 80,
        height: 60,
        top: 240,
        left: 88,
        chairs: Array(3)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 5,
        width: 80,
        height: 60,
        top: 285,
        left: 250,
        chairs: Array(2)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 6,
        width: 80,
        height: 60,
        top: 250,
        left: 520,
        chairs: Array(5)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
    ],
  },
  openSpace: {
    tables: [
      {
        id: 7,
        width: 120,
        height: 80,
        top: 50,
        left: 340,
        chairs: Array(8)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 8,
        width: 80,
        height: 120,
        top: 200,
        left: 200,
        chairs: Array(4)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
      {
        id: 9,
        width: 80,
        height: 120,
        top: 200,
        left: 500,
        chairs: Array(4)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
    ],
  },
  meetingRoom: {
    tables: [
      {
        id: 10,
        width: 220,
        height: 90,
        top: 130,
        left: 240,
        chairs: Array(8)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: true })),
      },
    ],
  },
};

// Map tableId and chairId to seat label
const mapToSeatLabel = (tableId: number, chairId: number): string => {
  return `${tableId}-${chairId}`;
};

// Apply filters for members
const applyMemberFilters = (
  members: Member[],
  searchTerm: string,
  journals: Journal[],
  abonnements: Abonnement[],
  selectedDate: Date
): Member[] => {
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

// Apply filters for bookings
const applyBookingFilters = (
  bookings: BookingWithMember[],
  searchTerm: string,
  selectedDate: Date
): BookingWithMember[] => {
  console.log("bookings", bookings, selectedDate);
  const filteredBookingsRes = bookings.filter((booking) => {
    return booking.subscriptionTypes.some((sub) => {
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
    });
  });

  if (!searchTerm || searchTerm.length < 2) {
    return filteredBookingsRes;
  }

  const fuse = new Fuse(filteredBookingsRes, bookingSearchOptions);
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
  const [selectedSpace, setSelectedSpace] = useState<
    "generalSpace" | "openSpace" | "meetingRoom" | null
  >("generalSpace");
  const [spaces, setSpaces] = useState(initialSpaces);
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

  const enrichBookingsWithMemberData = useCallback(
    async (bookingsData: BookingResponse[]): Promise<BookingWithMember[]> => {
      return Promise.all(
        bookingsData.map(async (booking) => {
          const member = members.find((m) => m.id === booking.memberId);
          const journal = journals.data.find(
            (j) =>
              j.memberID === booking.memberId &&
              j.registredTime &&
              (!j.leaveTime || new Date(j.leaveTime) > new Date()) &&
              new Date(j.registredTime).toDateString() ===
                selectedDate.toDateString()
          );
          const abonnement = abonnements.data.find(
            (a) =>
              a.memberID === booking.memberId &&
              a.registredDate &&
              (!a.leaveDate || new Date(a.leaveDate) > new Date())
          );
          const subscriptionTypes = [];
          if (journal) {
            subscriptionTypes.push({ type: "Journal", journal });
          }
          if (abonnement) {
            subscriptionTypes.push({ type: "Membership", abonnement });
          }
          return {
            ...booking,
            member,
            journal,
            abonnement,
            fullName: member
              ? `${member.firstName} ${member.lastName}`
              : "Unknown",
            subscriptionTypes,
          };
        })
      );
    },
    [members, journals.data, abonnements.data, selectedDate]
  );
  const fetchBookingsWhenChangeSpace = useCallback(
    async (allBookings: Array<any>) => {
      try {
        const updatedSpaces = JSON.parse(JSON.stringify(initialSpaces));
        allBookings.forEach((booking: BookingResponse) => {
          const match = booking.seatId.match(/(\d+)-(\d+)/);
          if (match) {
            const tableId = parseInt(match[1], 10);
            const chairId = parseInt(match[2], 10);
            Object.values(updatedSpaces).forEach((space: any) => {
              const table = space.tables.find((t: any) => t.id === tableId);
              if (table) {
                const chair = table.chairs.find((c: any) => c.id === chairId);
                if (chair) chair.isAvailable = false;
              }
            });
          }
        });
        setSpaces(updatedSpaces);
        const totalSeats = Object.values(updatedSpaces).reduce(
          (acc: number, space: any) => {
            return (
              acc +
              space.tables.reduce(
                (tableAcc: number, table: any) =>
                  tableAcc + table.chairs.length,
                0
              )
            );
          },
          0
        );
        setBookedSeats(allBookings.length);
        setAvailableSeats(totalSeats - allBookings.length);
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        setBookingError("Failed to load seat availability. Please try again.");
      }
    },
    []
  );

  const fetchBookings = useCallback(async () => {
    try {
      setIsLoading(true);
      const bookingsData = await bookingService.getAllBookings();
      fetchBookingsWhenChangeSpace(bookingsData);
      const enrichedBookings = await enrichBookingsWithMemberData(bookingsData);
      setBookings(enrichedBookings);
      const totalSeats = Object.values(initialSpaces).reduce(
        (acc: number, space: any) => {
          return (
            acc +
            space.tables.reduce(
              (tableAcc: number, table: any) => tableAcc + table.chairs.length,
              0
            )
          );
        },
        0
      );
      // Calculate stats based on all bookings, not filtered ones
      setBookedSeats(enrichedBookings.length);
      setAvailableSeats(totalSeats - enrichedBookings.length);
    } catch (error: any) {
      setBookingError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [enrichBookingsWithMemberData, fetchBookingsWhenChangeSpace]);

  useEffect(() => {
    // Only fetch bookings when we have the required data
    if (
      members.length > 0 ||
      journals.data.length > 0 ||
      abonnements.data.length > 0
    ) {
      fetchBookings();
    }
    refetchJournals();
  }, [
    fetchBookings,
    refetchJournals,
    members,
    journals.data,
    abonnements.data,
  ]);

  const checkExpiredBookings = useCallback(async () => {
    const now = new Date();
    for (const booking of bookings) {
      for (const sub of booking.subscriptionTypes) {
        if (
          sub.type === "Journal" &&
          sub.journal?.leaveTime &&
          new Date(sub.journal.leaveTime) <= now
        ) {
          await bookingService.deleteBooking(booking.id);
        }
        if (
          sub.type === "Membership" &&
          sub.abonnement?.leaveDate &&
          new Date(sub.abonnement.leaveDate) <= now
        ) {
          await bookingService.deleteBooking(booking.id);
        }
      }
    }
    await fetchBookings();
  }, [bookings, fetchBookings]);

  useEffect(() => {
    const interval = setInterval(checkExpiredBookings, 60000);
    return () => clearInterval(interval);
  }, [checkExpiredBookings]);

  console.log("isLoading", isLoading);

  const calculateRemainingTime = (subscription: {
    type: string;
    journal?: Journal;
    abonnement?: Abonnement;
  }): string => {
    const now = new Date();
    let endDate: Date | null = null;

    if (subscription.type === "Journal" && subscription.journal?.leaveTime) {
      endDate = new Date(subscription.journal.leaveTime);
    } else if (
      subscription.type === "Membership" &&
      subscription.abonnement?.leaveDate
    ) {
      endDate = new Date(subscription.abonnement.leaveDate);
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

  const handleChairSelect = useCallback(
    async (tableId: number, chairId: number, isAvailable: boolean) => {
      if (!isAvailable) return;

      const seatLabel = mapToSeatLabel(tableId, chairId);
      setCurrentSeat({ label: seatLabel, tableId, chairId });
      setBookingError(null);

      const booking = bookings.find((b) => b.seatId === seatLabel);
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
    [bookings, enrichBookingsWithMemberData]
  );

  //Set booking member from this function
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
        const data = await bookingService.createBooking(payload);

        setBookingSuccess("Booking updated successfully!");
      } else {
        const data = await bookingService.createBooking(payload);
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
  };

  const handleCloseSnackbar = () => {
    setBookingSuccess(null);
    setBookingError(null);
  };

  const getMemberName = (id: string) => {
    const member = members.find((m) => m.id === id);
    return member ? `${member.firstName} ${member.lastName}` : "Unknown";
  };

  const filteredMembers = applyMemberFilters(
    members,
    searchTerm,
    journals.data,
    abonnements.data,
    selectedDate
  );

  const filteredBookings = useMemo(
    () => applyBookingFilters(bookings, tableSearchTerm, selectedDate),
    [bookings, tableSearchTerm, selectedDate]
  );
  console.log("filteredBookings", filteredBookings);
  console.log("bookings", bookings);
  console.log("members", members);
  console.log("journals.data", journals.data);
  console.log("abonnements.data", abonnements.data);

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
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl sx={{ width: 140, height: 36 }}>
              <InputLabel>Select Space</InputLabel>
              <Select
                value={selectedSpace || ""}
                onChange={(e) =>
                  setSelectedSpace(
                    e.target.value as
                      | "generalSpace"
                      | "openSpace"
                      | "meetingRoom"
                  )
                }
                label="Select Space"
                sx={{ height: "100%" }}
              >
                <MenuItem value="generalSpace">General Space</MenuItem>
                <MenuItem value="openSpace">Open Space</MenuItem>
                <MenuItem value="meetingRoom">Meeting Room</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={isLoading}
              sx={{ width: 140, height: 36 }}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        <ChartContainer>
          {selectedSpace && (
            <SpaceMapContainer>
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <LegendItem>
                  <LegendDot theme={theme} color={theme.palette.success.main} />
                  <Typography variant="body2">Available</Typography>
                </LegendItem>
                <LegendItem>
                  <LegendDot theme={theme} color={theme.palette.error.main} />
                  <Typography variant="body2">Reserved</Typography>
                </LegendItem>
                <LegendItem>
                  <LegendDot theme={theme} color={theme.palette.primary.main} />
                  <Typography variant="body2">Selected</Typography>
                </LegendItem>
              </Box>

              <SpaceMap spaceType={selectedSpace}>
                {spaces[selectedSpace].tables.map((table) => (
                  <TableStyled
                    key={table.id}
                    sx={{
                      width: table.width,
                      height: table.height,
                      top: table.top,
                      left: table.left,
                      ...(table.id === 4 && {
                        transform: "rotate(45deg)",
                        transformOrigin: "center center",
                      }),
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: theme.palette.common.white,
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      Table {table.id}
                    </Typography>
                    {table.chairs.map((chair) => {
                      const isSelected = currentSeat
                        ? currentSeat.tableId === table.id &&
                          currentSeat.chairId === chair.id
                        : false;
                      const chairOffset = 16;
                      const tableWidth = table.width;
                      const tableHeight = table.height;
                      let position: {
                        top?: number;
                        bottom?: number;
                        left?: number;
                        right?: number;
                      } = {};

                      if (table.chairs.length === 2) {
                        if (table.id === 2 || table.id === 3) {
                          if (tableHeight > tableWidth) {
                            const spacing = tableHeight / 3;
                            if (chair.id === 1)
                              position = {
                                right: -chairOffset,
                                top: spacing - 11,
                              };
                            else if (chair.id === 2)
                              position = {
                                right: -chairOffset,
                                top: spacing * 2 - 11,
                              };
                          }
                        } else if (table.id === 5 && tableWidth > tableHeight) {
                          const spacing = tableWidth / 3;
                          if (chair.id === 1)
                            position = {
                              top: -chairOffset,
                              left: spacing - 11,
                            };
                          else if (chair.id === 2)
                            position = {
                              top: -chairOffset,
                              left: spacing * 2 - 11,
                            };
                        }
                      } else if (table.chairs.length === 3) {
                        if (table.id === 4 && tableWidth > tableHeight) {
                          const spacing = tableWidth / 4;
                          if (chair.id === 1)
                            position = {
                              top: -chairOffset,
                              left: spacing - 11,
                            };
                          else if (chair.id === 2)
                            position = {
                              top: -chairOffset,
                              left: spacing * 2 - 11,
                            };
                          else if (chair.id === 3)
                            position = {
                              top: -chairOffset,
                              left: spacing * 3 - 11,
                            };
                        }
                      } else if (table.chairs.length === 4) {
                        if (
                          (table.id === 8 || table.id === 9) &&
                          tableHeight > tableWidth
                        ) {
                          const spacing = tableHeight / 3;
                          if (chair.id === 1)
                            position = {
                              left: -chairOffset,
                              top: spacing - 11,
                            };
                          else if (chair.id === 2)
                            position = {
                              left: -chairOffset,
                              top: spacing * 2 - 11,
                            };
                          else if (chair.id === 3)
                            position = {
                              right: -chairOffset,
                              top: spacing - 11,
                            };
                          else if (chair.id === 4)
                            position = {
                              right: -chairOffset,
                              top: spacing * 2 - 11,
                            };
                        }
                      } else if (table.chairs.length === 5) {
                        if (table.id === 6 && tableWidth > tableHeight) {
                          const topSpacing = tableWidth / 3;
                          const bottomSpacing = tableWidth / 4;
                          if (chair.id === 1)
                            position = {
                              top: -chairOffset,
                              left: topSpacing - 11,
                            };
                          else if (chair.id === 2)
                            position = {
                              top: -chairOffset,
                              left: topSpacing * 2 - 11,
                            };
                          else if (chair.id === 3)
                            position = {
                              bottom: -chairOffset,
                              left: bottomSpacing - 11,
                            };
                          else if (chair.id === 4)
                            position = {
                              bottom: -chairOffset,
                              left: bottomSpacing * 2 - 11,
                            };
                          else if (chair.id === 5)
                            position = {
                              bottom: -chairOffset,
                              left: bottomSpacing * 3 - 11,
                            };
                        }
                      } else if (table.chairs.length === 8) {
                        if (table.id === 7) {
                          const spacing = tableWidth / 5;
                          if (chair.id <= 4) {
                            position = {
                              top: -chairOffset,
                              left: spacing * chair.id - 11,
                            };
                          } else {
                            position = {
                              bottom: -chairOffset,
                              left: spacing * (chair.id - 4) - 11,
                            };
                          }
                        } else if (table.id === 10) {
                          const topBottomSpacing = tableWidth / 4;
                          if (chair.id === 1)
                            position = {
                              top: -chairOffset,
                              left: topBottomSpacing - 11,
                            };
                          else if (chair.id === 2)
                            position = {
                              top: -chairOffset,
                              left: topBottomSpacing * 2 - 11,
                            };
                          else if (chair.id === 3)
                            position = {
                              top: -chairOffset,
                              left: topBottomSpacing * 3 - 11,
                            };
                          else if (chair.id === 4)
                            position = {
                              bottom: -chairOffset,
                              left: topBottomSpacing - 11,
                            };
                          else if (chair.id === 5)
                            position = {
                              bottom: -chairOffset,
                              left: topBottomSpacing * 2 - 11,
                            };
                          else if (chair.id === 6)
                            position = {
                              bottom: -chairOffset,
                              left: topBottomSpacing * 3 - 11,
                            };
                          else if (chair.id === 7)
                            position = {
                              left: -chairOffset,
                              top: tableHeight / 2 - 11,
                            };
                          else if (chair.id === 8)
                            position = {
                              right: -chairOffset,
                              top: tableHeight / 2 - 11,
                            };
                        }
                      } else if (table.chairs.length === 10) {
                        if (table.id === 1 && tableHeight > tableWidth) {
                          const spacing = tableHeight / 6;
                          if (chair.id <= 5) {
                            position = {
                              left: -chairOffset,
                              top: spacing * chair.id - 11,
                            };
                          } else {
                            position = {
                              right: -chairOffset,
                              top: spacing * (chair.id - 5) - 11,
                            };
                          }
                        }
                      }

                      return (
                        <Chair
                          key={chair.id}
                          theme={theme}
                          isAvailable={chair.isAvailable}
                          isSelected={isSelected}
                          onClick={() =>
                            handleChairSelect(
                              table.id,
                              chair.id,
                              chair.isAvailable
                            )
                          }
                          sx={{
                            position: "absolute",
                            ...position,
                            ...(table.id === 4 && {
                              transform: "rotate(45deg)",
                              transformOrigin: "center center",
                            }),
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              color: theme.palette.common.white,
                              fontSize: "0.6rem",
                              fontWeight: 600,
                            }}
                          >
                            {chair.id}
                          </Typography>
                        </Chair>
                      );
                    })}
                  </TableStyled>
                ))}
              </SpaceMap>
            </SpaceMapContainer>
          )}
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
                    filteredBookings.flatMap((booking) =>
                      booking.subscriptionTypes.map((sub, index) => (
                        <TableRow key={`${booking.id}-${sub.type}`}>
                          {index === 0 ? (
                            <>
                              <TableCell
                                rowSpan={booking.subscriptionTypes.length}
                              >
                                {booking.seatId}
                              </TableCell>
                              <TableCell
                                rowSpan={booking.subscriptionTypes.length}
                              >
                                {booking.member
                                  ? `${booking.member.firstName} ${booking.member.lastName}`
                                  : "Unknown"}
                              </TableCell>
                            </>
                          ) : null}
                          <TableCell>
                            <Chip
                              label={sub.type}
                              color={
                                sub.type === "Journal" ? "primary" : "secondary"
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {formatDate(
                              sub.type === "Journal"
                                ? sub.journal?.registredTime
                                : sub.abonnement?.registredDate
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDate(
                              sub.type === "Journal"
                                ? sub.journal?.leaveTime
                                : sub.abonnement?.leaveDate
                            )}
                          </TableCell>
                          <TableCell>{calculateRemainingTime(sub)}</TableCell>
                          {index === 0 ? (
                            <TableCell
                              rowSpan={booking.subscriptionTypes.length}
                            >
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
                                    const match =
                                      booking.seatId.match(/(\d+)-(\d+)/);
                                    const seat = match
                                      ? {
                                          label: booking.seatId,
                                          tableId: parseInt(match[1], 10),
                                          chairId: parseInt(match[2], 10),
                                        }
                                      : null;
                                    setSelectedBooking(enrichedBooking);
                                    setCurrentSeat(seat);
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
                                    await bookingService.deleteBooking(
                                      booking.id
                                    );
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
                          ) : null}
                        </TableRow>
                      ))
                    )
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
                  {selectedBooking.subscriptionTypes.map((sub) => (
                    <Box key={sub.type}>
                      <InfoRow>
                        <InfoIconWrapper>
                          {sub.type === "Journal" ? (
                            <PersonIcon />
                          ) : (
                            <DateIcon />
                          )}
                        </InfoIconWrapper>
                        <Box>
                          <Typography variant="subtitle2" color="textSecondary">
                            Subscription Type
                          </Typography>
                          <Typography variant="body1">{sub.type}</Typography>
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
                              sub.type === "Journal"
                                ? sub.journal?.registredTime
                                : sub.abonnement?.registredDate
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
                              sub.type === "Journal"
                                ? sub.journal?.leaveTime
                                : sub.abonnement?.leaveDate
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
                            {calculateRemainingTime(sub)}
                          </Typography>
                        </Box>
                      </InfoRow>
                    </Box>
                  ))}
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
