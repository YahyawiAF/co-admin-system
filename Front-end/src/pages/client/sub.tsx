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
  InputLabel,
  Stack,
  Chip,
} from "@mui/material";
import { Power } from "react-feather";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import useAuth from "src/hooks/useAuth";
import { Abonnement, Journal } from "src/types/shared";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import PublicLayout from "src/layouts/PublicLayout";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import {
  LocalizationProvider,
  DateCalendar,
  TimePicker,
} from "@mui/x-date-pickers";

// Extend the Abonnement and Journal types to include space and selectedChairs
interface ExtendedAbonnement extends Abonnement {
  space: string;
  selectedChairs: { tableId: number; chairId: number }[];
}

interface ExtendedJournal extends Journal {
  space: string;
  selectedChairs: { tableId: number; chairId: number }[];
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
    spaceType === "general"
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

const calculateLeaveDate = (price: Price, startDate: Date): Date => {
  const endDate = new Date(startDate);
  const priceName = price.name.toLowerCase();

  if (priceName.includes("semaine")) {
    endDate.setDate(endDate.getDate() + (priceName.includes("2") ? 14 : 7));
  } else if (priceName.includes("mois")) {
    const months = priceName.match(/3/) ? 3 : priceName.match(/6/) ? 6 : 1;
    endDate.setMonth(endDate.getMonth() + months);
  } else if (priceName.includes("année")) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  return endDate;
};

// Define spaces with their tables and chairs, including positions
const spaces = {
  general: {
    tables: [
      {
        id: 1,
        width: 120,
        height: 200,
        top: 20,
        left: 500,
        chairs: Array(10)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 2 === 0 })),
      },
      {
        id: 2,
        width: 60,
        height: 80,
        top: 20,
        left: 80,
        chairs: Array(2)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 3 !== 0 })),
      },
      {
        id: 3,
        width: 60,
        height: 80,
        top: 120,
        left: 80,
        chairs: Array(2)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 2 === 0 })),
      },
      {
        id: 4,
        width: 80,
        height: 60,
        top: 240,
        left: 88,
        chairs: Array(3)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 4 !== 0 })),
      },
      {
        id: 5,
        width: 80,
        height: 60,
        top: 285,
        left: 250,
        chairs: Array(2)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 2 === 0 })),
      },
      {
        id: 6,
        width: 80,
        height: 60,
        top: 250,
        left: 520,
        chairs: Array(5)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 3 !== 0 })),
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
          .map((_, i) => ({ id: i + 1, isAvailable: i % 2 === 0 })),
      },
      {
        id: 8,
        width: 80,
        height: 120,
        top: 200,
        left: 200,
        chairs: Array(4)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 3 !== 0 })),
      },
      {
        id: 9,
        width: 80,
        height: 120,
        top: 200,
        left: 500,
        chairs: Array(4)
          .fill(null)
          .map((_, i) => ({ id: i + 1, isAvailable: i % 2 === 0 })),
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
          .map((_, i) => ({ id: i + 1, isAvailable: i % 4 !== 0 })),
      },
    ],
  },
};

const SubscriptionSelection = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const { data: prices = [], isLoading, isError } = useGetPricesQuery();
  const [
    createAbonnement,
    {
      isLoading: isSubmittingAbonnement,
      isSuccess: isSuccessAbonnement,
      error: errorAbonnement,
    },
  ] = useCreateAbonnementMutation();
  const [
    createJournal,
    {
      isLoading: isSubmittingJournal,
      isSuccess: isSuccessJournal,
      error: errorJournal,
    },
  ] = useCreateJournalMutation();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [selectedJournalPrice, setSelectedJournalPrice] =
    useState<Price | null>(null);
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState<
    "abonnement" | "journal"
  >("abonnement");
  const [selectedSpace, setSelectedSpace] = useState<
    "general" | "openSpace" | "meetingRoom" | null
  >(null);
  const [selectedChairs, setSelectedChairs] = useState<
    { tableId: number; chairId: number }[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [chairsConfirmed, setChairsConfirmed] = useState(false);

  const steps = ["Select Date & Time", "Select Subscription", "Select Space"];

  const abonnementPrices = prices.filter(
    (price) => price.type === "abonnement"
  );
  const journalPrices = prices.filter((price) => price.type === "journal");

  const handleSignOut = async () => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      router.replace("/client/login");
      return;
    }

    try {
      await logout().unwrap();
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Déconnexion échouée:", error);
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  useEffect(() => {
    if (isSuccessAbonnement || isSuccessJournal) {
      setTimeout(() => {
        window.location.href = "/client/account";
      }, 2000);
    }
  }, [isSuccessAbonnement, isSuccessJournal]);

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
    if (activeStep === 0 && (!selectedDate || !selectedTime)) {
      setErrorMessage("Please select both a date and a time.");
      return;
    }
    if (activeStep === 1 && !selectedPrice && !selectedJournalPrice) {
      setErrorMessage("Please select a subscription type.");
      return;
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

  const handleFinalSubmit = async () => {
    if (!user || !user.id) {
      setErrorMessage("The selected member does not exist.");
      return;
    }

    // Combine selectedDate and selectedTime
    const combinedDateTime = selectedDate ? new Date(selectedDate) : new Date();
    if (selectedTime) {
      combinedDateTime.setHours(selectedTime.getHours());
      combinedDateTime.setMinutes(selectedTime.getMinutes());
    }

    if (selectedSubscriptionType === "abonnement" && selectedPrice) {
      try {
        const leaveDate = calculateLeaveDate(selectedPrice, combinedDateTime);
        const abonnementData: Partial<ExtendedAbonnement> = {
          isPayed: false,
          registredDate: combinedDateTime,
          leaveDate,
          payedAmount: selectedPrice.price,
          memberID: user.id,
          priceId: selectedPrice.id,
          stayedPeriode: `${selectedPrice.name} (${selectedPrice.timePeriod.start}-${selectedPrice.timePeriod.end})`,
          isReservation: true,
          space: selectedSpace!,
          selectedChairs,
        };
        await createAbonnement(abonnementData).unwrap();
      } catch (err: any) {
        setErrorMessage(
          err.data?.message || "Erreur lors de la création de l'abonnement"
        );
      }
    } else if (selectedSubscriptionType === "journal" && selectedJournalPrice) {
      try {
        const journalData: ExtendedJournal = {
          id: "unique-journal-id",
          isPayed: false,
          registredTime: combinedDateTime,
          leaveTime: combinedDateTime,
          payedAmount: selectedJournalPrice.price,
          memberID: user.id,
          priceId: selectedJournalPrice.id,
          isReservation: true,
          createdAt: combinedDateTime,
          updatedAt: combinedDateTime,
          space: selectedSpace!,
          selectedChairs,
        };
        await createJournal(journalData).unwrap();
      } catch (err: any) {
        setErrorMessage(
          err.data?.message || "Erreur lors de la création du journal"
        );
      }
    }
  };

  if (isLoading) return <CircularProgress />;
  if (isError)
    return <Alert severity="error">Erreur de chargement des tarifs</Alert>;

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
          <Tooltip title="Sign out">
            <IconButton
              onClick={handleSignOut}
              color="inherit"
              edge="end"
              sx={{
                "&:hover": { backgroundColor: theme.palette.action.hover },
              }}
            >
              <Power fontSize="medium" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 4 } }}
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
              {errorMessage}
            </Alert>
          )}
          {isSuccessAbonnement || isSuccessJournal ? (
            <Alert severity="success" sx={{ mb: 3, borderRadius: 1 }}>
              Subscription activated successfully! Redirecting...
            </Alert>
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
                      fontSize: { xs: "1rem", md: "1.5rem" },
                    }}
                  >
                    Select Date and Time
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <DateCalendar
                        value={selectedDate}
                        onChange={(newValue) => setSelectedDate(newValue)}
                        minDate={new Date()}
                        sx={{
                          width: "100%",
                          maxWidth: 500,
                          mx: "auto",
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 2,
                          backgroundColor: theme.palette.background.paper,
                          "& .MuiPickersDay-root": {
                            fontSize: "1rem",
                          },
                          "& .MuiPickersDay-root.Mui-selected": {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                          },
                          "& .MuiPickersDay-root:hover": {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      />
                      <TimePicker
                        label="Select Time"
                        value={selectedTime}
                        onChange={(newValue) => setSelectedTime(newValue)}
                        sx={{
                          width: "100%",
                          maxWidth: 300,
                          "& .MuiInputBase-root": {
                            borderRadius: 2,
                            backgroundColor: theme.palette.background.paper,
                          },
                        }}
                      />
                    </Box>
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
                      mb: 4,
                      fontWeight: 700,
                      fontSize: { xs: "1rem", md: "1.5rem" },
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
                      onClick={() => setSelectedSubscriptionType("abonnement")}
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
                      onClick={() => setSelectedSubscriptionType("journal")}
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
                                  Valid from {price.timePeriod.start} day to{" "}
                                  {price.timePeriod.end} day
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
                  ) : (
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
                                  From {price.timePeriod.start}h to{" "}
                                  {price.timePeriod.end}h
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
                      fontSize: { xs: "1rem", md: "1.5rem" },
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
                      onChange={(e) =>
                        setSelectedSpace(
                          e.target.value as
                            | "general"
                            | "openSpace"
                            | "meetingRoom"
                        )
                      }
                      label="Select Space"
                    >
                      <MenuItem value="general">General Space</MenuItem>
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
