import React, { useState, useEffect } from "react";
import { useTheme, styled } from '@mui/material/styles';
import {
  useGetPricesQuery,
  Price,
} from "src/api/price.repo";
import {
  useCreateAbonnementMutation,
} from "src/api/abonnement.repo";
import {
  useCreateJournalMutation,
} from "src/api/journal.repo"; // Import pour gérer les journaux
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Box,
  Alert,
} from "@mui/material";
import useAuth from "src/hooks/useAuth";
import { Abonnement, Journal } from "src/types/shared";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

// Style de la carte
const PriceCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[4],
  },
}));

// Fonction de calcul de date
const calculateLeaveDate = (price: Price, startDate: Date): Date => {
  const endDate = new Date(startDate);
  const priceName = price.name.toLowerCase();

  if (priceName.includes('semaine')) {
    endDate.setDate(endDate.getDate() + (priceName.includes('2') ? 14 : 7));
  } else if (priceName.includes('mois')) {
    const months = priceName.match(/3/) ? 3 : priceName.match(/6/) ? 6 : 1;
    endDate.setMonth(endDate.getMonth() + months);
  } else if (priceName.includes('année')) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  return endDate;
};

const SubscriptionSelection = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: prices = [], isLoading, isError } = useGetPricesQuery();
  const [createAbonnement, { isLoading: isSubmittingAbonnement, isSuccess: isSuccessAbonnement, error: errorAbonnement }] = useCreateAbonnementMutation();
  const [createJournal, { isLoading: isSubmittingJournal, isSuccess: isSuccessJournal, error: errorJournal }] = useCreateJournalMutation();

  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [selectedJournalPrice, setSelectedJournalPrice] = useState<Price | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const abonnementPrices = prices.filter(price => price.type === "abonnement");
  const journalPrices = prices.filter(price => price.type === "journal");

  useEffect(() => {
    if (isSuccessAbonnement || isSuccessJournal) {
      setTimeout(() => {
        window.location.href = "/client/account";
      }, 2000);
    }
  }, [isSuccessAbonnement, isSuccessJournal]);

  const handleSubscriptionSubmit = async () => {
    setErrorMessage('');

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
        memberID: user.id, // Utilisation de l'ID de l'utilisateur connecté
        priceId: selectedPrice.id,
        stayedPeriode: `${selectedPrice.name} (${selectedPrice.timePeriod.start}-${selectedPrice.timePeriod.end})`,
        isReservation: false,
      };

      await createAbonnement(abonnementData).unwrap();
    } catch (err: any) {
      console.error('Erreur complète:', err);
      setErrorMessage(
        err.data?.message ||
        err.message ||
        "Erreur lors de la création de l'abonnement"
      );
    }
  };

  const handleJournalSubmit = async () => {
    setErrorMessage('');
  
    if (!user || !user.id) {
      setErrorMessage("The selected member does not exist.");
      return;
    }
  
    if (!selectedJournalPrice) {
      setErrorMessage("Veuillez sélectionner un journal");
      return;
    }
  
    try {
      const now = new Date(); // Création de l'horodatage actuel
  
      // Assurez-vous que toutes les propriétés requises pour Journal sont définies
      const journalData: Journal = {
        id: "unique-journal-id", // Génération d'un ID unique (utilisez une bibliothèque comme UUID si nécessaire)
        isPayed: false,
        registredTime: now,
        leaveTime: now,
        payedAmount: selectedJournalPrice.price,
        memberID: user.id, // Utilisation de l'ID de l'utilisateur connecté
        priceId: selectedJournalPrice.id,
        isReservation: false,
        createdAt: now, // Ajout de la propriété createdAt
        updatedAt: now, // Ajout de la propriété updatedAt
      };
  
      // Appel de la mutation avec un objet complet
      await createJournal(journalData).unwrap();
    } catch (err: any) {
      console.error('Erreur complète:', err);
      setErrorMessage(
        err.data?.message ||
        err.message ||
        "Erreur lors de la création du journal"
      );
    }
  };

  if (isLoading) return <CircularProgress />;
  if (isError) return <Alert severity="error">Erreur de chargement des tarifs</Alert>;

  return (
    <RoleProtectedRoute allowedRoles={['USER']}>

    <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
      {/* Section Abonnement */}
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
      Monthly/Weekly Subscription
      </Typography>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {isSuccessAbonnement && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Abonnement activé avec succès! Redirection...
        </Alert>
      )}

      <Grid container spacing={3}>
        {abonnementPrices.map((price) => (
          <Grid item xs={12} md={4} key={price.id}>
            <PriceCard
              onClick={() => setSelectedPrice(price)}
              sx={{
                border: selectedPrice?.id === price.id
                  ? `2px solid ${theme.palette.primary.main}`
                  : '1px solid #ddd',
                backgroundColor: selectedPrice?.id === price.id
                  ? theme.palette.action.selected
                  : theme.palette.background.paper,
              }}
            >
              <CardContent>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {price.name}
                </Typography>

                <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline' }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {price.price} DT
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  Période: {price.timePeriod.start} à {price.timePeriod.end}
                </Typography>
              </CardContent>
            </PriceCard>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          disabled={!selectedPrice || isSubmittingAbonnement}
          onClick={handleSubscriptionSubmit}
          sx={{
            px: 6,
            py: 2,
            fontSize: '1.1rem',
            '&.Mui-disabled': {
              backgroundColor: theme.palette.action.disabledBackground,
            },
          }}
        >
          {isSubmittingAbonnement ? (
            <CircularProgress size={24} sx={{ color: 'white' }} />
          ) : (
            "Confirm"
          )}
        </Button>
      </Box>

      {/* Section Journal */}
      <Typography variant="h4" gutterBottom sx={{ mt: 6, mb: 4, fontWeight: 'bold' }}>
      Daily Subscription
      </Typography>

      {isSuccessJournal && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Journal créé avec succès! Redirection...
        </Alert>
      )}

      <Grid container spacing={3}>
        {journalPrices.map((price) => (
          <Grid item xs={12} md={4} key={price.id}>
            <PriceCard
              onClick={() => setSelectedJournalPrice(price)}
              sx={{
                border: selectedJournalPrice?.id === price.id
                  ? `2px solid ${theme.palette.primary.main}`
                  : '1px solid #ddd',
                backgroundColor: selectedJournalPrice?.id === price.id
                  ? theme.palette.action.selected
                  : theme.palette.background.paper,
              }}
            >
              <CardContent>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {price.name}
                </Typography>

                <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline' }}>
                  <Typography variant="h3" sx={{ fontWeight: 800 }}>
                    {price.price} DT
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  Période: {price.timePeriod.start} à {price.timePeriod.end}
                </Typography>
              </CardContent>
            </PriceCard>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          disabled={!selectedJournalPrice || isSubmittingJournal}
          onClick={handleJournalSubmit}
          sx={{
            px: 6,
            py: 2,
            fontSize: '1.1rem',
            '&.Mui-disabled': {
              backgroundColor: theme.palette.action.disabledBackground,
            },
          }}
        >
          {isSubmittingJournal ? (
            <CircularProgress size={24} sx={{ color: 'white' }} />
          ) : (
            "Confirm"
          )}
        </Button>
      </Box>
    </Box>
    </RoleProtectedRoute>
  );
};

export default SubscriptionSelection;