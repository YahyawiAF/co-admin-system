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
  Stack,
  Paper,
  AppBar,
  Toolbar,
  Container,
  Divider,
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

const PriceCard = styled(Card)(({ theme }) => ({
  cursor: "pointer",
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "translateY(-5px)",
    boxShadow: theme.shadows[4],
  },
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

  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [selectedJournalPrice, setSelectedJournalPrice] =
    useState<Price | null>(null);
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState<
    "abonnement" | "journal"
  >("abonnement");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const abonnementPrices = prices.filter(
    (price) => price.type === "abonnement"
  );
  const journalPrices = prices.filter((price) => price.type === "journal");

  const handleSignOut = async () => {
    const accessToken = sessionStorage.getItem("accessToken");
    const Role = sessionStorage.getItem("Role");
    const username = sessionStorage.getItem("username");

    if (!accessToken) {
      router.replace("/client/login");
      return;
    }

    try {
      await logout().unwrap();
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("userID");
      sessionStorage.removeItem("email");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("Role");
      sessionStorage.removeItem("phone");
      sessionStorage.removeItem("role");

      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Déconnexion échouée:", error);
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("userID");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("email");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("Role");
      sessionStorage.removeItem("phone");
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

  const handleSubscriptionSubmit = async () => {
    setErrorMessage("");
    if (!user || !user.id) {
      setErrorMessage("The selected member does not exist.");
      return;
    }

    if (!selectedPrice) {
      setErrorMessage("Veuillez sélectionner un abonnement");
      return;
    }

    try {
      const registrationDate = new Date();
      const leaveDate = calculateLeaveDate(selectedPrice, registrationDate);
      const abonnementData: Partial<Abonnement> = {
        isPayed: false,
        registredDate: registrationDate,
        leaveDate,
        payedAmount: selectedPrice.price,
        memberID: user.id,
        priceId: selectedPrice.id,
        stayedPeriode: `${selectedPrice.name} (${selectedPrice.timePeriod.start}-${selectedPrice.timePeriod.end})`,
        isReservation: false,
      };

      await createAbonnement(abonnementData).unwrap();
    } catch (err: any) {
      console.error("Erreur complète:", err);
      setErrorMessage(
        err.data?.message ||
          err.message ||
          "Erreur lors de la création de l'abonnement"
      );
    }
  };

  const handleJournalSubmit = async () => {
    setErrorMessage("");
    if (!user || !user.id) {
      setErrorMessage("The selected member does not exist.");
      return;
    }

    if (!selectedJournalPrice) {
      setErrorMessage("Veuillez sélectionner un journal");
      return;
    }

    try {
      const now = new Date();

      const journalData: Journal = {
        id: "unique-journal-id",
        isPayed: false,
        registredTime: now,
        leaveTime: now,
        payedAmount: selectedJournalPrice.price,
        memberID: user.id,
        priceId: selectedJournalPrice.id,
        isReservation: false,
        createdAt: now,
        updatedAt: now,
      };

      await createJournal(journalData).unwrap();
    } catch (err: any) {
      console.error("Erreur complète:", err);
      setErrorMessage(
        err.data?.message ||
          err.message ||
          "Erreur lors de la création du journal"
      );
    }
  };

  if (isLoading) return <CircularProgress />;
  if (isError)
    return <Alert severity="error">Erreur de chargement des tarifs</Alert>;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      {/* Header */}
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: (theme) => theme.palette.background.paper,
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
                "&:hover": {
                  backgroundColor: (theme) => theme.palette.action.hover,
                },
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
        {/* Subscription Type Toggle */}
        <Box
          sx={{
            textAlign: "center",
            mb: { xs: 3, md: 6 },
            "& .MuiButton-root": {
              minWidth: { xs: "100%", sm: 200 },
              mx: { xs: 0, sm: 2 },
              my: { xs: 1, sm: 0 },
            },
          }}
        >
          <Button
            variant={
              selectedSubscriptionType === "abonnement"
                ? "contained"
                : "outlined"
            }
            size="large"
            onClick={() => setSelectedSubscriptionType("abonnement")}
            sx={{ fontWeight: 600 }}
          >
            Membership
          </Button>
          <Button
            variant={
              selectedSubscriptionType === "journal" ? "contained" : "outlined"
            }
            size="large"
            onClick={() => setSelectedSubscriptionType("journal")}
            sx={{ fontWeight: 600 }}
          >
            Daily Pass
          </Button>
        </Box>

        {/* Content Section */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: (theme) => theme.palette.background.paper,
            p: { xs: 2, md: 4 },
          }}
        >
          {selectedSubscriptionType === "abonnement" ? (
            <>
              <Typography
                variant="h4"
                component="h2"
                sx={{
                  mb: 5,
                  fontWeight: 700,
                  fontSize: { xs: "1.25rem", md: "1.25rem" },
                }}
              >
                Monthly/Weekly Plans
              </Typography>

              {errorMessage && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>
                  {errorMessage}
                </Alert>
              )}

              {isSuccessAbonnement && (
                <Alert severity="success" sx={{ mb: 3, borderRadius: 1 }}>
                  Subscription activated successfully! Redirecting...
                </Alert>
              )}

              <Grid container spacing={3}>
                {abonnementPrices.map((price) => (
                  <Grid item xs={12} md={4} key={price.id}>
                    <PriceCard
                      onClick={() => setSelectedPrice(price)}
                      sx={{
                        height: "100%",
                        transition: "all 0.2s",
                        cursor: "pointer",
                        borderWidth: 2,
                        borderStyle: "solid",
                        borderColor:
                          selectedPrice?.id === price.id
                            ? (theme) => theme.palette.primary.main
                            : (theme) => theme.palette.divider,
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: 3,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 3, textAlign: "center" }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: (theme) => theme.palette.text.secondary,
                          }}
                        >
                          {price.name}
                        </Typography>

                        <Box sx={{ my: 3 }}>
                          <Typography
                            component="span"
                            sx={{
                              fontSize: "2.5rem",
                              fontWeight: 800,
                              lineHeight: 1,
                              color: (theme) => theme.palette.text.primary,
                            }}
                          >
                            {price.price}
                          </Typography>
                          <Typography
                            component="span"
                            variant="h5"
                            sx={{
                              fontWeight: 500,
                              ml: 1,
                              color: (theme) => theme.palette.text.secondary,
                            }}
                          >
                            DT
                          </Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography
                          variant="body2"
                          sx={{
                            color: (theme) => theme.palette.text.secondary,
                            fontSize: "0.9rem",
                          }}
                        >
                          Valid from {price.timePeriod.start} day to{" "}
                          {price.timePeriod.end} day
                        </Typography>
                      </CardContent>
                    </PriceCard>
                  </Grid>
                ))}
              </Grid>

              <Box
                sx={{
                  mt: 5,
                  textAlign: "center",
                  "& .MuiButton-root": {
                    width: { xs: "100%", sm: "auto" },
                    py: 1.5,
                    px: 8,
                  },
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  disabled={!selectedPrice || isSubmittingAbonnement}
                  onClick={handleSubscriptionSubmit}
                >
                  {isSubmittingAbonnement ? (
                    <CircularProgress size={24} sx={{ color: "white" }} />
                  ) : (
                    "Confirm Selection"
                  )}
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography
                variant="h4"
                component="h2"
                sx={{
                  mb: 4,
                  fontWeight: 700,
                  fontSize: { xs: "1.25rem", md: "1.25rem" },
                }}
              >
                Daily Passes
              </Typography>

              {isSuccessJournal && (
                <Alert severity="success" sx={{ mb: 3, borderRadius: 1 }}>
                  Daily pass created successfully! Redirecting...
                </Alert>
              )}

              <Grid container spacing={3}>
                {journalPrices.map((price) => (
                  <Grid item xs={12} md={4} key={price.id}>
                    <PriceCard
                      onClick={() => setSelectedJournalPrice(price)}
                      sx={{
                        height: "100%",
                        transition: "all 0.2s",
                        cursor: "pointer",
                        borderWidth: 2,
                        borderStyle: "solid",
                        borderColor:
                          selectedJournalPrice?.id === price.id
                            ? (theme) => theme.palette.primary.main
                            : (theme) => theme.palette.divider,
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: 3,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 3, textAlign: "center" }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: (theme) => theme.palette.text.secondary,
                          }}
                        >
                          {price.name}
                        </Typography>

                        <Box sx={{ my: 3 }}>
                          <Typography
                            component="span"
                            sx={{
                              fontSize: "2.5rem",
                              fontWeight: 800,
                              lineHeight: 1,
                              color: (theme) => theme.palette.text.primary,
                            }}
                          >
                            {price.price}
                          </Typography>
                          <Typography
                            component="span"
                            variant="h5"
                            sx={{
                              fontWeight: 500,
                              ml: 1,
                              color: (theme) => theme.palette.text.secondary,
                            }}
                          >
                            DT
                          </Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Typography
                          variant="body2"
                          sx={{
                            color: (theme) => theme.palette.text.secondary,
                            fontSize: "0.9rem",
                          }}
                        >
                          From {price.timePeriod.start}h {"to"}{" "}
                          {price.timePeriod.end}h
                        </Typography>
                      </CardContent>
                    </PriceCard>
                  </Grid>
                ))}
              </Grid>

              <Box
                sx={{
                  mt: 5,
                  textAlign: "center",
                  "& .MuiButton-root": {
                    width: { xs: "100%", sm: "auto" },
                    py: 1.5,
                    px: 8,
                  },
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  disabled={!selectedJournalPrice || isSubmittingJournal}
                  onClick={handleJournalSubmit}
                >
                  {isSubmittingJournal ? (
                    <CircularProgress size={24} sx={{ color: "white" }} />
                  ) : (
                    "Confirm Selection"
                  )}
                </Button>
              </Box>
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
