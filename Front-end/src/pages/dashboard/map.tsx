'use client'
import { useState, useCallback } from 'react'
import { SeatsioSeatingChart } from '@seatsio/seatsio-react'
import type { SelectableObject, TicketTypeJson } from '@seatsio/seatsio-types'
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
} from '@mui/material'
import DashboardLayout from '../../layouts/Dashboard'
import RoleProtectedRoute from 'src/components/auth/ProtectedRoute'
import type { ReactElement } from 'react'

interface SeatSelection {
  label: string
  category?: {
    key: string
  }
}

interface Pricing {
  category: string
  price: number
  label?: string
}

// Styles personnalisés
const PageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 'calc(100vh - 64px)',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
}))

const MainContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  boxShadow: theme.shadows[1],
  marginTop: theme.spacing(2),
  flex: 1,
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
}))

const ChartContainer = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  overflow: 'hidden',
  height: '500px',
}))

const BookingPanel = styled(Card)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
}))

const SubmitButton = styled(Button)(({ theme }) => ({
  border: '1px solid',
  borderColor: '#054547',
  background: '#fff',
  color: '#054547',
  width: '100%',
  height: '50px',
  lineHeight: '50px',
  cursor: 'pointer',
  borderRadius: 0,
  '&:hover': {
    background: '#054547',
    color: '#fff',
  },
  [theme.breakpoints.up('sm')]: {
    width: 'auto',
  },
}))

function SeatingChart() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [selectedSeats, setSelectedSeats] = useState<SeatSelection[]>([])
  const [isBooking, setIsBooking] = useState<boolean>(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false)
  const [chartError, setChartError] = useState<string | null>(null)

  const pricing: Pricing[] = [
    { category: '1', price: 20, label: 'Standard' },
    { category: '2', price: 30, label: 'Premium' },
  ]

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
      ])
      setBookingError(null)
    }
  }, [])

  const handleObjectDeselected = useCallback((object: SelectableObject) => {
    setSelectedSeats((prev) => prev.filter((seat) => seat.label !== object.label))
  }, [])

  const totalPrice = selectedSeats.reduce((sum, seat) => {
    const seatCategory = seat.category?.key || '1'
    const priceInfo = pricing.find((p) => p.category === seatCategory)
    return sum + (priceInfo?.price || 0)
  }, 0)

  const handleBookSeats = async () => {
    if (selectedSeats.length === 0) return;

    setIsBooking(true);
    setBookingError(null);

    try {
      // Utilisez maintenant votre endpoint NestJS au lieu de l'API directe
      const response = await fetch('http://localhost:4000/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventKey: '180346ed-b27d-4677-8975-f4b168d98cc0',
          seats: selectedSeats.map((seat) => seat.label),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la réservation');
      }

      setBookingSuccess(true);
      setSelectedSeats([]);
      setTimeout(() => setBookingSuccess(false), 3000);
    } catch (error: unknown) {
      setBookingError(error instanceof Error ? error.message : 'Une erreur inconnue est survenue');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Réservation d'espace de coworking
      </Typography>

      <MainContainer>
        {chartError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Erreur de chargement du plan:</strong> {chartError}
              <br />
              Vérifiez vos clés d'API et votre connexion internet.
            </Typography>
          </Alert>
        )}

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
                  colorSelected: '#3B82F6',
                  availableObjectColor: '#E5E7EB',
                  errorColor: '#EF4444',
                }}
                showLegend={true}
                language="fr"
                pricing={pricing}
                priceFormatter={(price: number) => `${price} €`}
                tooltipInfo={(object: SelectableObject) => {
                  const category = object.category?.key || '1'
                  const priceInfo = pricing.find((p) => p.category === category)
                  return `${object.label} - ${priceInfo?.label || 'Standard'}: ${priceInfo?.price || 0}€`
                }}
                messages={{
                  notAvailable: 'Réservé', // Remplace "indisponible" par "réservé"
                }}
              />
            </ChartContainer>
          </Grid>

          <Grid item xs={12}>
            <BookingPanel>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Votre sélection
                </Typography>

                {selectedSeats.length > 0 ? (
                  <>
                    <List>
                      {selectedSeats.map((seat) => {
                        const category = seat.category?.key || '1'
                        const priceInfo = pricing.find((p) => p.category === category)
                        return (
                          <ListItem key={seat.label} divider>
                            <ListItemText
                              primary={`Place ${seat.label} (${priceInfo?.label || 'Standard'})`}
                              secondary={`${priceInfo?.price || 0}€`}
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="h6">
                        Total: {totalPrice}€
                      </Typography>
                      <SubmitButton
                        onClick={handleBookSeats}
                        disabled={isBooking}
                        sx={{ minWidth: isMobile ? '100%' : '200px' }}
                      >
                        {isBooking ? <CircularProgress size={24} /> : 'Confirmer la réservation'}
                      </SubmitButton>
                    </Box>
                  </>
                ) : (
                  <Typography color="text.secondary">
                    Sélectionnez des places sur le plan
                  </Typography>
                )}

                {bookingError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Erreur: {bookingError}
                  </Alert>
                )}
                {bookingSuccess && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Réservation confirmée avec succès !
                  </Alert>
                )}
              </CardContent>
            </BookingPanel>
          </Grid>
        </Grid>
      </MainContainer>
    </PageContainer>
  )
}

// Layout avec protection de rôle
SeatingChart.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={['ADMIN']}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  )
}

export default SeatingChart