import React, { useState, ReactElement } from "react";
import { styled, ThemeProvider, createTheme } from "@mui/material/styles";
import { useGetProductsQuery, Product } from "src/api/productApi";
import {
  useCreateDailyProductMutation,
  useGetDailyProductsQuery,
  useUpdateDailyProductMutation,
} from "src/api/dailyproductApi";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import FixedBottomNavigation from "src/components/bottomNavigation/BottomNavigation";

// Custom theme for professional and modern design
const theme = createTheme({
  palette: {
    primary: {
      main: "#1E3A8A",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#2DD4BF",
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
      "@media (max-width: 600px)": {
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
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          maxWidth: "600px",
          width: "100%",
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
  const [createDailyProduct] = useCreateDailyProductMutation();
  const [updateDailyProduct] = useUpdateDailyProductMutation();
  const {
    data: dailyProducts = [],
    isLoading: isDailyLoading,
    isError: isDailyError,
  } = useGetDailyProductsQuery();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [openModal, setOpenModal] = useState(false);

  // Get memberId from sessionStorage
  const memberId = sessionStorage.getItem("member");

  // Debug user and sessionStorage
  console.log("User from useAuth:", user);
  console.log("Member ID from sessionStorage:", memberId);
  console.log(
    "Access Token from sessionStorage:",
    sessionStorage.getItem("accessToken")
  );

  // Filter daily products by memberId
  const memberDailyProducts = dailyProducts.filter(
    (dp) => dp.memberId === memberId
  );

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
      console.error("Sign out failed:", error);
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

  const handleConfirmSelection = async () => {
    if (!selectedProduct) {
      setErrorMessage("Please select a product.");
      return;
    }

    // Check if product is out of stock
    if (selectedProduct.stock <= 0) {
      setErrorMessage("This product is out of stock.");
      return;
    }

    const memberId = sessionStorage.getItem("member");
    console.log("Raw memberId from sessionStorage:", memberId);

    if (!memberId || memberId.trim() === "") {
      setErrorMessage("No valid member ID found. Please log in again.");
      router.replace("/client/login");
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      setErrorMessage("No access token found. Please log in again.");
      router.replace("/client/login");
      return;
    }

    // Validate memberId format (basic UUID check)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(memberId)) {
      setErrorMessage("Invalid member ID format. Please log in again.");
      console.error("Invalid memberId format:", memberId);
      return;
    }

    const newQuantity = 1; // Quantity to add
    const currentDate = new Date().toISOString().split("T")[0]; // Current date (YYYY-MM-DD)

    // Check for existing DailyProduct with same productId, memberId, and date
    const existingDailyProduct = memberDailyProducts.find(
      (dp) =>
        dp.productId === selectedProduct.id &&
        dp.memberId === memberId &&
        dp.date?.split("T")[0] === currentDate
    );

    try {
      if (existingDailyProduct) {
        // Update existing DailyProduct
        console.log("Updating existing DailyProduct:", existingDailyProduct.id);
        const response = await updateDailyProduct({
          id: existingDailyProduct.id,
          data: {
            quantite: existingDailyProduct.quantite + newQuantity,
          },
        }).unwrap();
        console.log("DailyProduct update response:", response);
        setSuccessMessage(
          `Quantity for "${selectedProduct.name}" updated successfully! Redirecting...`
        );
      } else {
        // Create new DailyProduct
        const payload = {
          productId: selectedProduct.id,
          quantite: newQuantity,
          date: currentDate,
          memberId,
        };
        console.log("Creating DailyProduct with payload:", payload);
        const response = await createDailyProduct(payload).unwrap();
        console.log("DailyProduct creation response:", response);
        setSuccessMessage(
          `Product "${selectedProduct.name}" added successfully! Redirecting...`
        );
      }

      setTimeout(() => {
        router.push("/client/account");
      }, 2000);
    } catch (error: any) {
      console.error("Failed to process daily product:", error);
      const errorMsg =
        error.data?.message ||
        error.message ||
        "Failed to add or update product. Please try again.";
      setErrorMessage(errorMsg);
    }
  };

  const handleOpenModal = () => {
    if (!memberId || memberId.trim() === "") {
      setErrorMessage("Please log in to view your daily products.");
      router.replace("/client/login");
      return;
    }
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
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
          Error loading products
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
              Snacks Menu
            </Typography>
            <Tooltip title="View Your Daily Products">
              <IconButton
                onClick={handleOpenModal}
                sx={{
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.primary.main,
                  },
                  mr: 1,
                }}
              >
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sign Out">
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
              Choose Your Snack
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
                disabled={!selectedProduct || selectedProduct.stock <= 0}
                onClick={handleConfirmSelection}
                sx={{ px: 4, py: 1.5 }}
              >
                Confirm
              </Button>
            </Box>
          </Paper>
        </Container>

        {/* Daily Products Modal */}
        <Dialog
          open={openModal}
          onClose={handleCloseModal}
          aria-labelledby="daily-products-dialog-title"
        >
          <DialogTitle id="daily-products-dialog-title">
            Your Daily Products
          </DialogTitle>
          <DialogContent>
            {isDailyLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={32} color="primary" />
              </Box>
            ) : isDailyError ? (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                Error loading your daily products
              </Alert>
            ) : memberDailyProducts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                You have no daily products.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price (DT)</TableCell>
                      <TableCell align="right">Total Price (DT)</TableCell>
                      <TableCell align="right">Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {memberDailyProducts.map((dp) => (
                      <TableRow key={dp.id}>
                        <TableCell>{dp.product.name}</TableCell>
                        <TableCell align="right">{dp.quantite}</TableCell>
                        <TableCell align="right">
                          {dp.product.sellingPrice.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {(dp.quantite * dp.product.sellingPrice).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {dp.date
                            ? new Date(dp.date).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal} variant="outlined">
              Close
            </Button>
          </DialogActions>
        </Dialog>

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
