import React, { useState, useEffect, ReactElement } from "react";
import { useTheme, styled } from "@mui/material/styles";
import { useGetPricesQuery, Price } from "src/api/price.repo";
import { useCreateAbonnementMutation } from "src/api/abonnement.repo";
import { useCreateJournalMutation } from "src/api/journal.repo";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Box,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  AppBar,
  Toolbar,
  Container,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Select,
  MenuItem,
  FormControl,
  Stack,
  Chip,
  InputLabel,
  Avatar,
  Dialog,
  DialogContent,
  Fade,
} from "@mui/material";
import { Power, X } from "react-feather";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import useAuth from "src/hooks/useAuth";
import { Abonnement, Journal, BookingResponse } from "src/types/shared";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import PublicLayout from "src/layouts/PublicLayout";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { FormProvider, useForm } from "react-hook-form";
import { RHFDatePeakerField } from "src/components/hook-form/RHTextFieldDate";
import { format } from "date-fns";
import meetingRoomImage from "public/images/meeting.png";
import generalSpaceImage from "public/images/general.png";
import openSpaceImage from "public/images/open.png";
import { BookingService } from "src/api/bookingservice";
import { BookSeatsPayload } from "src/types/shared";

// Use environment variable for API URL
const API_URL = process.env.NEXT_PUBLIC_WEB_SERVER || "http://localhost:4000/";

// Instantiate BookingService
const bookingService = new BookingService(API_URL);

// Extend the Abonnement and Journal types to include space and selectedChairs
interface ExtendedAbonnement extends Abonnement {
  space: string;
  selectedChairs: { tableId: number; chairId: number }[];
  createdbyUserID?: string;
}

interface ExtendedJournal extends Journal {
  space: string;
  selectedChairs: { tableId: number; chairId: number }[];
}

// Form data interface for react-hook-form
interface FormData {
  selectedDateTime: Date | null;
}

// Styled components for professional design
const PriceCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  position: "relative",
  cursor: "pointer",
  transition: "all 0.3s ease",
  borderRadius: 12,
  background: isSelected
    ? `linear-gradient(135deg, ${theme.palette.primary.light}22, ${theme.palette.background.paper})`
    : theme.palette.background.paper,
  border: `2px solid ${
    isSelected ? theme.palette.primary.main : theme.palette.divider
  }`,
  boxShadow: isSelected ? theme.shadows[8] : theme.shadows[2],
  width: "100%",
  maxWidth: 300,
  margin: "0 auto",
  overflow: "hidden",
  "&:hover": {
    transform: "translateY(-8px)",
    boxShadow: theme.shadows[6],
    borderColor: theme.palette.primary.light,
  },
}));

const PriceCardHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(2),
  textAlign: "center",
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

const Table = styled(Box)(({ theme }) => ({
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

const NavigationContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
}));

const SpaceStepContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
}));

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

// Map tableId and chairId to seat.io label
const mapToSeatIoLabel = (tableId: number, chairId: number): string => {
  // Use tableId-chairId format to match seat.io chart
  return `${tableId}-${chairId}`;
};

// Parse time string to minutes
const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;

  const [hoursStr, minutesStr] = timeStr.split("h");
  const hours = parseInt(hoursStr) || 0;
  const minutes = parseInt(minutesStr) || 0;

  return hours * 60 + minutes;
};

// Find matching price based on duration
const findMatchingPrice = (
  startDate: Date,
  endDate: Date,
  journalPrices: Price[]
): Price | null => {
  if (!journalPrices || journalPrices.length === 0) return null;

  const realDurationMinutes = Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60)
  );

  const sortedPrices = [...journalPrices].sort((a, b) => {
    const aMax = parseTimeToMinutes(a.timePeriod.end);
    const bMax = parseTimeToMinutes(b.timePeriod.end);
    return aMax - bMax;
  });

  for (const price of sortedPrices) {
    const priceMax = parseTimeToMinutes(price.timePeriod.end);
    if (realDurationMinutes <= priceMax + 15) {
      return price;
    }
  }

  return sortedPrices[sortedPrices.length - 1] || null;
};

// Calculate leave date based on price and start date
const calculateLeaveDate = (price: Price, startDate: Date): Date => {
  const leaveDate = new Date(startDate);

  if (price.type === "abonnement") {
    const start = parseInt(price.timePeriod.start, 10);
    const end = parseInt(price.timePeriod.end, 10);
    const durationDays = end - start;

    if (durationDays > 0) {
      leaveDate.setDate(leaveDate.getDate() + durationDays);
    } else {
      leaveDate.setDate(leaveDate.getDate() + 30);
    }
  } else if (price.type === "journal") {
    const endTime = price.timePeriod.end;
    const minutes = parseTimeToMinutes(endTime);
    if (minutes > 0) {
      leaveDate.setMinutes(leaveDate.getMinutes() + minutes);
    } else {
      leaveDate.setHours(leaveDate.getHours() + 2);
    }
  }

  return leaveDate;
};

const calculateStayedPeriode = (price: Price): string => {
  if (price.type === "abonnement") {
    return `${price.name} (${price.timePeriod.start}-${price.timePeriod.end} days)`;
  } else {
    return `${price.name} (${price.timePeriod.start}-${price.timePeriod.end})`;
  }
};

// Format time remaining
const formatTimeRemaining = (timeDiff: number): string => {
  if (timeDiff <= 0) return "00:00:00";

  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const SubscriptionSelection = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [logoutQuery] = useLogoutMutation();
  const { data: prices = [], isLoading, isError } = useGetPricesQuery();
  const [
    createAbonnement,
    {
      isLoading: isSubmittingAbonnement,
      isSuccess: isSuccessAbonnement,
      error: errorAbonnement,
      data: abonnementData,
    },
  ] = useCreateAbonnementMutation();
  const [
    createJournal,
    {
      isLoading: isSubmittingJournal,
      isSuccess: isSuccessJournal,
      error: errorJournal,
      data: journalData,
    },
  ] = useCreateJournalMutation();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [selectedJournalPrice, setSelectedJournalPrice] =
    useState<Price | null>(null);
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState<
    "abonnement" | "journal" | null
  >(null);
  const [selectedSpace, setSelectedSpace] = useState<
    "generalSpace" | "openSpace" | "meetingRoom" | null
  >(null);
  const [selectedChairs, setSelectedChairs] = useState<
    { tableId: number; chairId: number }[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [chairsConfirmed, setChairsConfirmed] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [journalTimeRemaining, setJournalTimeRemaining] = useState<string>("");
  const [abonnementTimeRemaining, setAbonnementTimeRemaining] =
    useState<string>("");
  const [spaces, setSpaces] = useState(initialSpaces);

  const steps = ["Date & Time", "Subscription", "Space"];
  const abonnementPrices = prices.filter(
    (price) => price.type === "abonnement"
  );
  const journalPrices = prices.filter((price) => price.type === "journal");

  // Initialize react-hook-form
  const methods = useForm<FormData>({
    defaultValues: {
      selectedDateTime: new Date(),
    },
  });

  // Fetch bookings to update seat availability
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const bookings = await bookingService.getAllBookings();
        const updatedSpaces = JSON.parse(JSON.stringify(initialSpaces));
        bookings.forEach((booking: BookingResponse) => {
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
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        setErrorMessage("Failed to load seat availability. Please try again.");
      }
    };
    fetchBookings();
  }, []);

  // Refresh bookings when space changes
  useEffect(() => {
    if (selectedSpace) {
      const fetchBookings = async () => {
        try {
          const bookings = await bookingService.getAllBookings();
          const updatedSpaces = JSON.parse(JSON.stringify(initialSpaces));
          bookings.forEach((booking: BookingResponse) => {
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
        } catch (error) {
          console.error("Failed to fetch bookings:", error);
          setErrorMessage("Failed to load seat availability. Please try again.");
        }
      };
      fetchBookings();
    }
  }, [selectedSpace]);

  // Countdown timer logic for journal
  useEffect(() => {
    if (isSuccessJournal && journalData?.leaveTime) {
      const leaveTime = new Date(journalData.leaveTime);
      const updateTimer = () => {
        const now = new Date();
        const timeDiff = leaveTime.getTime() - now.getTime();
        setJournalTimeRemaining(formatTimeRemaining(timeDiff));
      };
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuccessJournal, journalData]);

  // Countdown timer logic for abonnement
  useEffect(() => {
    if (isSuccessAbonnement && abonnementData?.leaveDate) {
      const leaveDate = new Date(abonnementData.leaveDate);
      const updateTimer = () => {
        const now = new Date();
        const timeDiff = leaveDate.getTime() - now.getTime();
        setAbonnementTimeRemaining(formatTimeRemaining(timeDiff));
      };
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuccessAbonnement, abonnementData]);

  const handleSignOut = async () => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      router.replace("/client/login");
      return;
    }
    try {
      await logoutQuery().unwrap();
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Sign out failed:", error);
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  const handleChairSelect = (
    tableId: number,
    chairId: number,
    isAvailable: boolean
  ) => {
    if (!isAvailable) return;
    setSelectedChairs((prev) => {
      const chair = { tableId, chairId };
      const exists = prev.some(
        (c) => c.tableId === tableId && c.chairId === chairId
      );
      if (exists) {
        return prev.filter(
          (c) => !(c.tableId === tableId && c.chairId === chairId)
        );
      }
      return [...prev, chair];
    });
    setChairsConfirmed(false);
  };

  const handleConfirmChairs = () => {
    if (selectedChairs.length === 0) {
      setErrorMessage("Please select at least one chair.");
      return;
    }
    setErrorMessage("");
    setChairsConfirmed(true);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      const selectedDateTime = methods.getValues("selectedDateTime");
      if (!selectedDateTime) {
        setErrorMessage("Please select a date and time.");
        return;
      }
    }
    if (activeStep === 1) {
      if (!selectedSubscriptionType) {
        setErrorMessage("Please select a subscription type.");
        return;
      }
      if (
        (selectedSubscriptionType === "abonnement" && !selectedPrice) ||
        (selectedSubscriptionType === "journal" && !selectedJournalPrice)
      ) {
        setErrorMessage("Please select a plan for the chosen subscription type.");
        return;
      }
    }
    if (activeStep === 2 && (!selectedSpace || !chairsConfirmed)) {
      setErrorMessage(
        !selectedSpace
          ? "Please select a space."
          : "Please confirm your chair selection."
      );
      return;
    }
    setErrorMessage("");
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    setErrorMessage("");
    setChairsConfirmed(false);
    setActiveStep((prev) => prev - 1);
  };

  const handleGoToDashboard = () => {
    setActiveStep(0);
    setSelectedPrice(null);
    setSelectedJournalPrice(null);
    setSelectedSubscriptionType(null);
    setSelectedSpace(null);
    setSelectedChairs([]);
    setChairsConfirmed(false);
    setErrorMessage("");
    router.push("/client/account");
  };

  const handleFinalSubmit = async () => {
    const memberId = sessionStorage.getItem("member");
    const createdByID = sessionStorage.getItem("userID");
    if (!memberId) {
      setErrorMessage("No member ID found. Please log in again.");
      return;
    }
    if (!selectedSubscriptionType) {
      setErrorMessage("No subscription type selected.");
      return;
    }

    const selectedDateTime = methods.getValues("selectedDateTime") || new Date();
    const selectedChair = selectedChairs[0];
    if (!selectedChair) {
      setErrorMessage("No chair selected.");
      return;
    }
    const seatId = mapToSeatIoLabel(selectedChair.tableId, selectedChair.chairId);

    try {
      if (selectedSubscriptionType === "abonnement" && selectedPrice) {
        const leaveDate = calculateLeaveDate(selectedPrice, selectedDateTime);
        const stayedPeriode = calculateStayedPeriode(selectedPrice);
        const abonnementData: Partial<ExtendedAbonnement> = {
          isPayed: false,
          registredDate: selectedDateTime,
          leaveDate,
          payedAmount: selectedPrice.price,
          memberID: memberId,
          priceId: selectedPrice.id,
          stayedPeriode,
          isReservation: true,
          space: selectedSpace!,
          selectedChairs,
          createdbyUserID: createdByID ?? undefined,
        };
        await createAbonnement(abonnementData).unwrap();

        const bookingPayload: BookSeatsPayload = {
          eventKey: "180346ed-b27d-4677-8975-f4b168d98cc0",
          seats: [seatId],
          memberId,
        };
        await bookingService.createBooking(bookingPayload);
      } else if (selectedSubscriptionType === "journal" && selectedJournalPrice) {
        const stayedPeriode = calculateStayedPeriode(selectedJournalPrice);
        const now = new Date();
        const leaveTime = calculateLeaveDate(selectedJournalPrice, selectedDateTime);
        const journalData: Journal = {
          id: "",
          isPayed: false,
          registredTime: selectedDateTime,
          leaveTime,
          payedAmount: selectedJournalPrice.price,
          memberID: memberId,
          priceId: selectedJournalPrice.id,
          isReservation: true,
          createdbyUserID: createdByID,
          space: selectedSpace!,
          selectedChairs,
          stayedPeriode,
          createdAt: now,
          updatedAt: now,
        };
        await createJournal(journalData).unwrap();

        const bookingPayload: BookSeatsPayload = {
          eventKey: "180346ed-b27d-4677-8975-f4b168d98cc0",
          seats: [seatId],
          memberId,
        };
        await bookingService.createBooking(bookingPayload);
      }
      setActiveStep(0);
      setSelectedPrice(null);
      setSelectedJournalPrice(null);
      setSelectedSubscriptionType(null);
      setSelectedSpace(null);
      setSelectedChairs([]);
      setChairsConfirmed(false);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Error creating subscription or booking";
      const suggestion = err.response?.data?.suggestion || "Please try a different seat.";
      setErrorMessage(`${errorMessage} - Suggestion: ${suggestion}`);
    }
  };

  if (isLoading) return <CircularProgress />;
  if (isError) return <Alert severity="error">Error loading prices</Alert>;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Header */}
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1280,
            mx: "auto",
            width: "100%",
            px: { xs: 2, sm: 4 },
          }}
        >
          <Typography
            variant="h5"
            component="h1"
            fontWeight={500}
            sx={{ flexGrow: 1 }}
          >
            Subscription Management
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Tooltip title="Sign out">
              <IconButton
                onClick={handleSignOut}
                color="inherit"
                sx={{
                  "&:hover": { backgroundColor: theme.palette.action.hover },
                }}
              >
                <Power fontSize="medium" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Account Settings">
              <IconButton
                onClick={() => router.push("/client/account")}
                sx={{
                  p: 0,
                }}
              >
                <Avatar
                  src={sessionStorage.getItem("img") || undefined}
                  alt={sessionStorage.getItem("username") || "User"}
                  sx={{
                    width: 32,
                    height: 32,
                    border: `2px solid ${theme.palette.primary.main}`,
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 12, md: 16 }, px: { xs: 2, sm: 4 } }}
      >
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            p: { xs: 2, md: 4 },
            position: "relative",
          }}
        >
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>
              {errorMessage.split(" - Suggestion: ")[0]}
              {errorMessage.includes(" - Suggestion: ") && (
                <>
                  <br />
                  <strong>Suggestion:</strong>{" "}
                  {errorMessage.split(" - Suggestion: ")[1]}
                </>
              )}
            </Alert>
          )}
          {(errorAbonnement || errorJournal) && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>
              {errorAbonnement
                ? (errorAbonnement as any).data?.message ||
                  "Error creating subscription"
                : (errorJournal as any).data?.message ||
                  "Error creating daily pass"}
            </Alert>
          )}
          {isSuccessAbonnement || isSuccessJournal ? (
            <Box sx={{ textAlign: "center" }}>
              <Alert severity="success" sx={{ mb: 3, borderRadius: 1 }}>
                {isSuccessAbonnement
                  ? "Subscription activated successfully!"
                  : "Daily pass created successfully!"}
              </Alert>
              {isSuccessJournal && journalTimeRemaining && (
                <Box
                  sx={{
                    mt: 4,
                    p: 3,
                    borderRadius: 2,
                    backgroundColor: theme.palette.primary.light,
                    color: theme.palette.primary.contrastText,
                    boxShadow: theme.shadows[4],
                  }}
                >
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
                    Daily Pass Time Remaining
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    {journalTimeRemaining}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                    Your daily pass will expire at{" "}
                    {journalData?.leaveTime
                      ? format(new Date(journalData.leaveTime), "PPp")
                      : ""}
                  </Typography>
                </Box>
              )}
              {isSuccessAbonnement && abonnementTimeRemaining && (
                <Box
                  sx={{
                    mt: 4,
                    p: 3,
                    borderRadius: 2,
                    backgroundColor: theme.palette.primary.light,
                    color: theme.palette.primary.contrastText,
                    boxShadow: theme.shadows[4],
                  }}
                >
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
                    Membership Time Remaining
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    {abonnementTimeRemaining}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                    Your membership will expire at{" "}
                    {abonnementData?.leaveDate
                      ? format(new Date(abonnementData.leaveDate), "PPp")
                      : ""}
                  </Typography>
                </Box>
              )}
              <Button
                variant="contained"
                onClick={handleGoToDashboard}
                sx={{
                  mt: 4,
                  py: 1.5,
                  px: 6,
                  borderRadius: 8,
                }}
              >
                Go to Dashboard
              </Button>
            </Box>
          ) : (
            <>
              {/* Step 1: Select Date and Time */}
              {activeStep === 0 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                      mb: 4,
                      fontWeight: 700,
                      fontSize: { xs: "1.5rem", md: "1.5rem" },
                    }}
                  >
                    Select Date and Time
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <FormProvider {...methods}>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <RHFDatePeakerField
                          name="selectedDateTime"
                          label="Select Date and Time"
                          minDate={new Date()}
                          sx={{
                            width: "100%",
                            maxWidth: 300,
                          }}
                        />
                        {(journalTimeRemaining || abonnementTimeRemaining) && (
                          <Box sx={{ mt: 2, textAlign: "center" }}>
                            {journalTimeRemaining && (
                              <Box sx={{ mb: 2 }}>
                                <Typography
                                  variant="h6"
                                  sx={{ fontWeight: 600 }}
                                >
                                  Daily Pass Time Remaining
                                </Typography>
                                <Typography
                                  variant="h4"
                                  sx={{
                                    fontWeight: 800,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {journalTimeRemaining}
                                </Typography>
                                {journalData?.leaveTime && (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      mt: 1,
                                      color: theme.palette.text.secondary,
                                    }}
                                  >
                                    Expires at{" "}
                                    {format(
                                      new Date(journalData.leaveTime),
                                      "PPp"
                                    )}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            {abonnementTimeRemaining && (
                              <Box>
                                <Typography
                                  variant="h6"
                                  sx={{ fontWeight: 600 }}
                                >
                                  Membership Time Remaining
                                </Typography>
                                <Typography
                                  variant="h4"
                                  sx={{
                                    fontWeight: 800,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {abonnementTimeRemaining}
                                </Typography>
                                {abonnementData?.leaveDate && (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      mt: 1,
                                      color: theme.palette.text.secondary,
                                    }}
                                  >
                                    Expires at{" "}
                                    {format(
                                      new Date(abonnementData.leaveDate),
                                      "PPp"
                                    )}
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    </FormProvider>
                  </LocalizationProvider>
                  <NavigationContainer>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{
                        py: 1.5,
                        px: 6,
                        minWidth: { xs: "100%", sm: 150 },
                        borderRadius: 8,
                      }}
                    >
                      Next
                    </Button>
                  </NavigationContainer>
                </Box>
              )}

              {/* Step 2: Select Subscription Type */}
              {activeStep === 1 && (
                <>
                  <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                      textAlign: "center",
                      mb: 4,
                      fontWeight: 700,
                      fontSize: { xs: "1.5rem", md: "1.5rem" },
                    }}
                  >
                    Select Subscription Type
                  </Typography>
                  <Box sx={{ textAlign: "center", mb: 4 }}>
                    <Button
                      variant={
                        selectedSubscriptionType === "abonnement"
                          ? "contained"
                          : "outlined"
                      }
                      size="large"
                      onClick={() => {
                        if (selectedSubscriptionType === "abonnement") {
                          setSelectedSubscriptionType(null);
                          setSelectedPrice(null);
                        } else {
                          setSelectedSubscriptionType("abonnement");
                          setSelectedJournalPrice(null);
                        }
                      }}
                      sx={{
                        minWidth: { xs: "100%", sm: 200 },
                        mx: { xs: 0, sm: 2 },
                        my: { xs: 1, sm: 0 },
                        fontWeight: 600,
                        borderRadius: 8,
                        py: 1.5,
                      }}
                    >
                      Membership
                    </Button>
                    <Button
                      variant={
                        selectedSubscriptionType === "journal"
                          ? "contained"
                          : "outlined"
                      }
                      size="large"
                      onClick={() => {
                        if (selectedSubscriptionType === "journal") {
                          setSelectedSubscriptionType(null);
                          setSelectedJournalPrice(null);
                        } else {
                          setSelectedSubscriptionType("journal");
                          setSelectedPrice(null);
                        }
                      }}
                      sx={{
                        minWidth: { xs: "100%", sm: 200 },
                        mx: { xs: 0, sm: 2 },
                        my: { xs: 1, sm: 0 },
                        fontWeight: 600,
                        borderRadius: 8,
                        py: 1.5,
                      }}
                    >
                      Daily Pass
                    </Button>
                  </Box>

                  {selectedSubscriptionType === "abonnement" ? (
                    <>
                      <Typography
                        variant="h5"
                        sx={{ mb: 4, fontWeight: 600, textAlign: "center" }}
                      >
                        Monthly/Weekly Plans
                      </Typography>
                      <Grid container spacing={3} justifyContent="center">
                        {abonnementPrices.map((price) => (
                          <Grid item xs={12} sm={6} md={4} key={price.id}>
                            <PriceCard
                              isSelected={selectedPrice?.id === price.id}
                              onClick={() => setSelectedPrice(price)}
                            >
                              <PriceCardHeader>
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: "1.25rem",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {price.name}
                                </Typography>
                              </PriceCardHeader>
                              <CardContent
                                sx={{
                                  p: 3,
                                  textAlign: "center",
                                  minHeight: 180,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Box sx={{ my: 2 }}>
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontSize: "2.25rem",
                                      fontWeight: 800,
                                      lineHeight: 1.2,
                                      color: theme.palette.text.primary,
                                    }}
                                  >
                                    {price.price}
                                  </Typography>
                                  <Typography
                                    component="span"
                                    variant="h6"
                                    sx={{
                                      fontWeight: 500,
                                      ml: 1,
                                      color: theme.palette.text.secondary,
                                    }}
                                  >
                                    DT
                                  </Typography>
                                </Box>
                                <Divider sx={{ my: 2 }} />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: theme.palette.text.secondary,
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  Valid from {price.timePeriod.start} to{" "}
                                  {price.timePeriod.end} days
                                </Typography>
                                {selectedPrice?.id === price.id && (
                                  <Chip
                                    label="Selected"
                                    color="primary"
                                    size="small"
                                    sx={{
                                      position: "absolute",
                                      top: 10,
                                      right: 10,
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </CardContent>
                            </PriceCard>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  ) : selectedSubscriptionType === "journal" ? (
                    <>
                      <Typography
                        variant="h5"
                        sx={{ mb: 4, fontWeight: 600, textAlign: "center" }}
                      >
                        Daily Passes
                      </Typography>
                      <Grid container spacing={3} justifyContent="center">
                        {journalPrices.map((price) => (
                          <Grid item xs={12} sm={6} md={4} key={price.id}>
                            <PriceCard
                              isSelected={selectedJournalPrice?.id === price.id}
                              onClick={() => setSelectedJournalPrice(price)}
                            >
                              <PriceCardHeader>
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: "1.25rem",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {price.name}
                                </Typography>
                              </PriceCardHeader>
                              <CardContent
                                sx={{
                                  p: 3,
                                  textAlign: "center",
                                  minHeight: 180,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Box sx={{ my: 2 }}>
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontSize: "2.25rem",
                                      fontWeight: 800,
                                      lineHeight: 1.2,
                                      color: theme.palette.text.primary,
                                    }}
                                  >
                                    {price.price}
                                  </Typography>
                                  <Typography
                                    component="span"
                                    variant="h6"
                                    sx={{
                                      fontWeight: 500,
                                      ml: 1,
                                      color: theme.palette.text.secondary,
                                    }}
                                  >
                                    DT
                                  </Typography>
                                </Box>
                                <Divider sx={{ my: 2 }} />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: theme.palette.text.secondary,
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  From {price.timePeriod.start} to{" "}
                                  {price.timePeriod.end} hours
                                </Typography>
                                {selectedJournalPrice?.id === price.id && (
                                  <Chip
                                    label="Selected"
                                    color="primary"
                                    size="small"
                                    sx={{
                                      position: "absolute",
                                      top: 10,
                                      right: 10,
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </CardContent>
                            </PriceCard>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{
                        textAlign: "center",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      Please select a subscription type to view available plans.
                    </Typography>
                  )}
                  <NavigationContainer>
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                      sx={{
                        py: 1.5,
                        px: 6,
                        minWidth: { xs: "100%", sm: 150 },
                        borderRadius: 8,
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{
                        py: 1.5,
                        px: 6,
                        minWidth: { xs: "100%", sm: 150 },
                        borderRadius: 8,
                      }}
                    >
                      Next
                    </Button>
                  </NavigationContainer>
                </>
              )}

              {/* Step 3: Select Space and Chairs */}
              {activeStep === 2 && (
                <SpaceStepContainer>
                  <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                      mb: 4,
                      fontWeight: 700,
                      fontSize: { xs: "1.5rem", md: "1.5rem" },
                      textAlign: "center",
                    }}
                  >
                    Select a Space and Chairs
                  </Typography>
                  <FormControl
                    fullWidth
                    sx={{ mb: 4, maxWidth: 400, mx: "auto" }}
                  >
                    <InputLabel>Select Space</InputLabel>
                    <Select
                      value={selectedSpace || ""}
                      onChange={(e) => {
                        setSelectedSpace(
                          e.target.value as
                            | "generalSpace"
                            | "openSpace"
                            | "meetingRoom"
                        );
                        setOpenModal(true);
                      }}
                      label="Select Space"
                      renderValue={(value) => (
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 2 }}
                        >
                          {value && (
                            <Avatar
                              variant="square"
                              src={
                                value === "meetingRoom"
                                  ? meetingRoomImage.src
                                  : value === "generalSpace"
                                  ? generalSpaceImage.src
                                  : openSpaceImage.src
                              }
                              sx={{ width: 50, height: 50 }}
                            />
                          )}
                          <Typography>{value || "Select Space"}</Typography>
                        </Box>
                      )}
                    >
                      <MenuItem value="generalSpace">General Space</MenuItem>
                      <MenuItem value="openSpace">Open Space</MenuItem>
                      <MenuItem value="meetingRoom">Meeting Room</MenuItem>
                    </Select>
                  </FormControl>

                  {selectedSpace && (
                    <SpaceMapContainer>
                      <Stack
                        direction="row"
                        spacing={3}
                        sx={{ mb: 2, justifyContent: "center" }}
                      >
                        <LegendItem>
                          <LegendDot
                            theme={theme}
                            color={theme.palette.success.main}
                          />
                          <Typography variant="body2">Available</Typography>
                        </LegendItem>
                        <LegendItem>
                          <LegendDot
                            theme={theme}
                            color={theme.palette.error.main}
                          />
                          <Typography variant="body2">Reserved</Typography>
                        </LegendItem>
                        <LegendItem>
                          <LegendDot
                            theme={theme}
                            color={theme.palette.primary.main}
                          />
                          <Typography variant="body2">Selected</Typography>
                        </LegendItem>
                      </Stack>

                      <SpaceMap spaceType={selectedSpace}>
                        {spaces[selectedSpace].tables.map((table) => (
                          <Table
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
                              const isSelected = selectedChairs.some(
                                (c) =>
                                  c.tableId === table.id &&
                                  c.chairId === chair.id
                              );
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
                                } else if (
                                  table.id === 5 &&
                                  tableWidth > tableHeight
                                ) {
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
                                if (
                                  table.id === 4 &&
                                  tableWidth > tableHeight
                                ) {
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
                                if (
                                  table.id === 6 &&
                                  tableWidth > tableHeight
                                ) {
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
                                if (
                                  table.id === 1 &&
                                  tableHeight > tableWidth
                                ) {
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
                          </Table>
                        ))}
                      </SpaceMap>

                      <Box sx={{ mt: 3, mb: 2, textAlign: "center" }}>
                        <Button
                          variant="contained"
                          onClick={handleConfirmChairs}
                          disabled={
                            selectedChairs.length === 0 || chairsConfirmed
                          }
                          sx={{
                            py: 1.5,
                            px: 6,
                            fontWeight: 600,
                            fontSize: "1rem",
                            borderRadius: 8,
                            minWidth: 200,
                          }}
                        >
                          {chairsConfirmed
                            ? "Selection Confirmed"
                            : "Confirm Selection"}
                        </Button>
                      </Box>

                      <NavigationContainer>
                        <Button
                          variant="outlined"
                          onClick={handleBack}
                          sx={{
                            py: 1.5,
                            px: 6,
                            minWidth: { xs: "100%", sm: 150 },
                            borderRadius: 8,
                          }}
                        >
                          Back
                        </Button>
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          sx={{
                            py: 1.5,
                            px: 6,
                            minWidth: { xs: "100%", sm: 150 },
                            borderRadius: 8,
                          }}
                          disabled={
                            isSubmittingAbonnement ||
                            isSubmittingJournal ||
                            !chairsConfirmed
                          }
                        >
                          {isSubmittingAbonnement || isSubmittingJournal ? (
                            <CircularProgress
                              size={24}
                              sx={{ color: "white" }}
                            />
                          ) : (
                            "Confirm Subscription"
                          )}
                        </Button>
                      </NavigationContainer>
                    </SpaceMapContainer>
                  )}
                </SpaceStepContainer>
              )}
            </>
          )}
        </Paper>
      </Container>

      {/* Modal for displaying the selected space image */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth={false}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          style: {
            width: 700,
            height: 350,
            maxWidth: 700,
            maxHeight: 350,
            margin: 0,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: theme.shadows[10],
            border: "none",
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          <img
            src={
              selectedSpace === "meetingRoom"
                ? meetingRoomImage.src
                : selectedSpace === "generalSpace"
                ? generalSpaceImage.src
                : openSpaceImage.src
            }
            alt={selectedSpace || "Space Preview"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <IconButton
            onClick={() => setOpenModal(false)}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: theme.palette.common.white,
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.8)",
              },
              transition: "background-color 0.2s ease",
              borderRadius: "50%",
              padding: 0.5,
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>
      </Dialog>
    </Box>
  );
};

SubscriptionSelection.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
      <RoleProtectedRoute allowedRoles={["USER"]}>{page}</RoleProtectedRoute>
    </PublicLayout>
  );
};

export default SubscriptionSelection;