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

const PriceCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[4],
  },
}));

const calculateLeaveDate = (price: Price, startDate: Date): Date => {
  const endDate = new Date(startDate);
  const priceName = price.name.toLowerCase();

  if (priceName.includes('semaine') || priceName.includes('week')) {
    const weeks = priceName.includes('2') ? 2 : 1;
    endDate.setDate(endDate.getDate() + 7 * weeks);
  } else if (priceName.includes('mois') || priceName.includes('month')) {
    const months = priceName.includes('3') ? 3 : priceName.includes('6') ? 6 : 1;
    endDate.setMonth(endDate.getMonth() + months);
  } else if (priceName.includes('année') || priceName.includes('year')) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  return endDate;
};

const getDurationLabel = (priceName: string): string => {
  const name = priceName.toLowerCase();
  
  if (name.includes('semaine')) {
    return name.includes('2') ? '2 Semaines' : '1 Semaine';
  }
  if (name.includes('mois')) {
    if (name.includes('3')) return '3 Mois';
    if (name.includes('6')) return '6 Mois';
    return '1 Mois';
  }
  if (name.includes('année')) return '1 An';
  
  return '';
};

const SubscriptionSelection = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: prices = [], isLoading, isError } = useGetPricesQuery();
  const [createAbonnement, { isLoading: isSubmitting, isSuccess, error }] = useCreateAbonnementMutation();
  
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const abonnementPrices = prices.filter(price => price.type === "abonnement");

  const handleSubscriptionSubmit = async () => {
    if (!selectedPrice || !user?.id) return;

    const registrationDate = new Date();
    const leaveDate = calculateLeaveDate(selectedPrice, registrationDate);

    try {
      await createAbonnement({
        memberID: user.id,
        priceId: selectedPrice.id,
        registredDate: registrationDate,
        leaveDate,
        payedAmount: selectedPrice.price,
        isPayed: false,
        stayedPeriode: `${selectedPrice.name} (${selectedPrice.timePeriod.start}-${selectedPrice.timePeriod.end})`,
      }).unwrap();
      
    } catch (err) {
      console.error("Erreur lors de la création de l'abonnement:", err);
    }
  };

  if (isLoading) return <CircularProgress />;
  if (isError) return <Alert severity="error">Erreur de chargement des abonnements</Alert>;

  return (
   
      <Box sx={{ p: 4, maxWidth: 1200, margin: '0 auto' }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
          Choisissez votre abonnement
        </Typography>

        {isSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Abonnement créé avec succès !
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {(error as any).data?.message || "Erreur lors de la création de l'abonnement"}
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
                    : '1px solid #e0e0e0',
                  backgroundColor: selectedPrice?.id === price.id 
                    ? theme.palette.action.selected 
                    : theme.palette.background.paper,
                }}
              >
                <CardContent>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
                    {price.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {getDurationLabel(price.name)}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
                      {price.price} DT
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      /{price.timePeriod.end.toLowerCase()}
                    </Typography>
                  </Box>
                 
                </CardContent>
              </PriceCard>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            disabled={!selectedPrice || isSubmitting}
            onClick={handleSubscriptionSubmit}
            sx={{
              px: 6,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={24} />
            ) : (
              'Activer mon abonnement'
            )}
          </Button>
        </Box>
      </Box>
  );
};

export default SubscriptionSelection;