import React, { useState, ReactElement } from "react";
import { styled, ThemeProvider, createTheme } from "@mui/material/styles";
import { useGetProductsQuery, Product } from "src/api/productApi";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Box,
  Alert,
  Paper,
  AppBar,
  Toolbar,
  Container,
  Divider,
  Avatar,
  Chip,
  Tooltip,
  IconButton,
} from "@mui/material";
import { Power } from "react-feather";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import useAuth from "src/hooks/useAuth";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import PublicLayout from "src/layouts/PublicLayout";
import InventoryIcon from "@mui/icons-material/Inventory";
import FixedBottomNavigation from "src/components/bottomNavigation/BottomNavigation"; // Import original

// Custom theme for professional and modern design
const theme = createTheme({
  palette: {
    primary: {
      main: "#1E3A8A", // Deep blue
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#2DD4BF", // Teal accent
    },
    background: {
      default: "#F7FAFC",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1F2937",
      secondary: "#6B7280",
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', sans-serif",
    h4: {
      fontWeight: 700,
      fontSize: "1.75rem",
      "@media (max-width:600px)": {
        fontSize: "1.5rem",
      },
    },
    h6: {
      fontWeight: 600,
      fontSize: "1.125rem",
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 500,
          padding: "10px 20px",
          transition: "all 0.3s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: "#FFFFFF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        },
      },
    },
  },
});

// Styled components
const ProductCard = styled(Card)(({ theme }) => ({
  cursor: "pointer",
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "translateY(-5px)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
  },
  [theme.breakpoints.down("sm")]: {
    margin: "0 auto",
    maxWidth: 300,
  },
}));

const ProductMedia = styled(Box)(({ theme }) => ({
  height: 160,
  backgroundColor: theme.palette.grey[100],
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  borderRadius: "12px 12px 0 0",
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    height: 140,
  },
}));

const StockChip = styled(Chip)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(1),
  fontSize: "0.75rem",
  fontWeight: "bold",
  padding: "2px 6px",
}));

const Snacks = () => {
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const { data: products = [], isLoading, isError } = useGetProductsQuery();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

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

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleConfirmSelection = () => {
    if (!user || !user.id) {
      setErrorMessage("Vous devez être connecté pour sélectionner un produit.");
      return;
    }

    if (!selectedProduct) {
      setErrorMessage("Veuillez sélectionner un produit.");
      return;
    }

    setSuccessMessage(
      `Produit "${selectedProduct.name}" sélectionné avec succès ! Redirection...`
    );
    setTimeout(() => {
      router.push("/client/account");
    }, 2000);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress size={48} color="primary" />
      </Box>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2, boxShadow: 1 }}>
          Erreur lors du chargement des produits
        </Alert>
      </Container>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <AppBar position="static" elevation={0}>
          <Toolbar
            sx={{
              maxWidth: 1200,
              mx: "auto",
              width: "100%",
              px: { xs: 2, sm: 3 },
            }}
          >
            <Typography
              variant="h5"
              component="h1"
              sx={{
                flexGrow: 1,
                fontWeight: 700,
                color: theme.palette.text.primary,
              }}
            >
              Menu Snacks
            </Typography>
            <Tooltip title="Déconnexion">
              <IconButton
                onClick={handleSignOut}
                sx={{
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.primary.main,
                  },
                }}
              >
                <Power fontSize="small" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container
          maxWidth="lg"
          sx={{ py: { xs: 3, md: 5 }, pb: { xs: 12, md: 14 }, flexGrow: 1 }}
        >
          <Paper
            elevation={0}
            sx={{
              borderRadius: 12,
              border: `1px solid ${theme.palette.divider}`,
              p: { xs: 2, sm: 4 },
              background: "linear-gradient(145deg, #FFFFFF, #F9FAFB)",
            }}
          >
            <Typography
              variant="h4"
              component="h2"
              sx={{ mb: 3, textAlign: "center" }}
            >
              Choisissez Votre Snack
            </Typography>
            <Divider sx={{ mb: 4 }} />

            {errorMessage && (
              <Alert
                severity="error"
                sx={{ mb: 3, borderRadius: 2, maxWidth: 600, mx: "auto" }}
              >
                {errorMessage}
              </Alert>
            )}

            {successMessage && (
              <Alert
                severity="success"
                sx={{ mb: 3, borderRadius: 2, maxWidth: 600, mx: "auto" }}
              >
                {successMessage}
              </Alert>
            )}

            <Grid container spacing={{ xs: 2, md: 3 }}>
              {products.map((product) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <ProductCard
                    onClick={() => handleProductSelect(product)}
                    sx={{
                      border: `2px solid ${
                        selectedProduct?.id === product.id
                          ? theme.palette.primary.main
                          : "transparent"
                      }`,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <ProductMedia>
                      {product.img ? (
                        <img
                          src={product.img}
                          alt={product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transition: "transform 0.3s ease",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.transform = "scale(1.05)")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.transform = "scale(1)")
                          }
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 80,
                            height: 80,
                            bgcolor: theme.palette.primary.main,
                          }}
                        >
                          <InventoryIcon sx={{ fontSize: 40 }} />
                        </Avatar>
                      )}
                      <StockChip
                        label={`Stock: ${product.stock}`}
                        color={
                          product.stock > 10
                            ? "success"
                            : product.stock > 0
                            ? "warning"
                            : "error"
                        }
                        size="small"
                      />
                    </ProductMedia>
                    <CardContent
                      sx={{
                        p: 2,
                        textAlign: "center",
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography
                          variant="h6"
                          sx={{ mb: 1, fontWeight: 600 }}
                        >
                          {product.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            mb: 2,
                            color: theme.palette.text.secondary,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {product.description}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 1.5 }}>
                        <Typography
                          component="span"
                          sx={{ fontSize: "1.5rem", fontWeight: 700 }}
                        >
                          {product.sellingPrice.toFixed(2)}
                        </Typography>
                        <Typography
                          component="span"
                          variant="body1"
                          sx={{ ml: 0.5, fontWeight: 500 }}
                        >
                          DT
                        </Typography>
                      </Box>
                    </CardContent>
                  </ProductCard>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ mt: 4, textAlign: "center" }}>
              <Button
                variant="contained"
                size="large"
                disabled={!selectedProduct}
                onClick={handleConfirmSelection}
                sx={{ px: 4, py: 1.5 }}
              >
                Confirmer la Sélection
              </Button>
            </Box>
          </Paper>
        </Container>

        {/* Original Bottom Navigation */}
        <FixedBottomNavigation />
      </Box>
    </ThemeProvider>
  );
};

Snacks.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
      <RoleProtectedRoute allowedRoles={["USER"]}>{page}</RoleProtectedRoute>
    </PublicLayout>
  );
};

export default Snacks;
