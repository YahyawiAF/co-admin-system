import React, { useMemo, useState } from "react";
import styled from "@emotion/styled";
import { useTranslation } from "react-i18next";
import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
  Box,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
} from "@mui/material";
import { spacing } from "@mui/system";
import {
  DollarSign,
  CreditCard,
  User,
  TrendingUp,
  Activity,
  ShoppingCart,
} from "react-feather";
import { format } from "date-fns";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import InventoryIcon from "@mui/icons-material/Inventory"; // Added for default product icon
import Stats from "../landing/stats";
import {
  Journal,
  DailyExpense,
  ExpenseType,
  DailyProduct,
} from "src/types/shared";
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import {
  useDeleteDailyExpenseMutation,
  useUpdateDailyExpenseMutation,
} from "src/api/dailyexpenseApi";
import DailyExpenseModal from "src/components/pages/dashboard/journal/dailyexpense";
import {
  useCreateDailyProductMutation,
  useGetProductsQuery,
  useUpdateDailyProductMutation,
  useDeleteDailyProductMutation,
  useUpdateProductMutation,
} from "src/api/productApi";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

const ProductCard = styled(Card)(({ theme }) => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  transition: "transform 0.3s, box-shadow 0.3s",
  "&:hover": {
    transform: "translateY(-5px)",
    boxShadow: theme.shadows[6],
  },
}));

const ProductMedia = styled(Box)(({ theme }) => ({
  height: 140,
  backgroundColor: theme.palette.grey[100],
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StockChip = styled(Chip)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(1),
  fontWeight: "bold",
}));

const ProductContent = styled(CardContent)(({ theme }) => ({
  flexGrow: 1,
}));

const ProductPrice = styled(Typography)(({ theme }) => ({
  color: theme.palette.success.dark,
  fontWeight: "bold",
  marginTop: theme.spacing(1),
}));

interface JournalDetailsProps {
  journals: Journal[];
  dailyExpenses: DailyExpense[];
  dailyProducts: DailyProduct[];
  isLoading: boolean;
  errorMemberReq: boolean;
  selectedDate: Date;
  expenses: Array<{ id: string; name: string; amount: number; type: string }>;
}

function JournalDetails({
  journals,
  dailyExpenses,
  dailyProducts,
  isLoading,
  errorMemberReq,
  selectedDate,
  expenses = [],
}: JournalDetailsProps) {
  const { t } = useTranslation();

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements,
  } = useGetAbonnementsQuery({ search: "" });

  // Expense mutations
  const [deleteDailyExpense] = useDeleteDailyExpenseMutation();
  const [updateDailyExpense] = useUpdateDailyExpenseMutation();

  // Product mutations
  const [updateProduct] = useUpdateProductMutation();
  const [createDailyProduct] = useCreateDailyProductMutation();
  const [updateDailyProduct] = useUpdateDailyProductMutation();
  const [deleteDailyProduct] = useDeleteDailyProductMutation();

  // Data fetching
  const {
    data: products,
    isLoading: isLoadingProducts,
    error: errorProducts,
    refetch: refetchProducts,
  } = useGetProductsQuery();

  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<DailyExpense | null>(
    null
  );

  const handleQuantityChange = async (
    productId: string,
    increment: boolean
  ) => {
    try {
      const product = products?.find((p) => p.id === productId);
      if (!product) return;

      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      const existingDailyProduct = dailyProducts?.find(
        (dp) =>
          dp.productId === productId &&
          isSameDay(new Date(dp.date || dp.createdAt), selectedDate)
      );

      if (increment) {
        if (product.stock <= 0) {
          alert("Stock insuffisant!");
          return;
        }

        if (existingDailyProduct) {
          // Update existing daily product
          await updateDailyProduct({
            id: existingDailyProduct.id,
            data: {
              quantite: existingDailyProduct.quantite + 1,
              date: formattedDate,
            },
          }).unwrap();
        } else {
          // Create new daily product
          await createDailyProduct({
            productId,
            quantite: 1,
            date: formattedDate,
          }).unwrap();
        }

        // Update product stock
        await updateProduct({
          id: productId,
          data: { stock: product.stock - 1 },
        }).unwrap();
      } else {
        if (existingDailyProduct && existingDailyProduct.quantite > 0) {
          const newQuantity = existingDailyProduct.quantite - 1;

          if (newQuantity > 0) {
            // Update existing daily product
            await updateDailyProduct({
              id: existingDailyProduct.id,
              data: {
                quantite: newQuantity,
                date: formattedDate,
              },
            }).unwrap();
          } else {
            // Delete daily product if quantity is 0
            await deleteDailyProduct(existingDailyProduct.id).unwrap();
          }

          // Update product stock
          await updateProduct({
            id: productId,
            data: { stock: product.stock + 1 },
          }).unwrap();
        }
      }

      await refetchProducts();
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      alert("Une erreur est survenue lors de la mise à jour");
    }
  };

  const dailyExpensesTotal = useMemo(() => {
    return dailyExpenses.reduce((acc, curr) => acc + curr.expense.amount, 0);
  }, [dailyExpenses]);

  const dailyMembersCount = useMemo(() => {
    return journals.filter((journal) => {
      const journalDate = new Date(journal.registredTime);
      return isSameDay(journalDate, selectedDate);
    }).length;
  }, [journals, selectedDate]);

  const dailySubscribedMembersCount = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    return abonnementsData.data.filter((abonnement) => {
      const abonnementDate = new Date(abonnement.createdAt);
      return isSameDay(abonnementDate, selectedDate);
    }).length;
  }, [abonnementsData, selectedDate]);

  const cashTotal = useMemo(() => {
    const dailyJournalsTotal = journals
      .filter((journal) =>
        isSameDay(new Date(journal.registredTime), selectedDate)
      )
      .reduce(
        (acc, curr) => (curr.isPayed ? acc + (curr.payedAmount || 0) : acc),
        0
      );

    const dailySubscriptionsTotal =
      abonnementsData?.data
        ?.filter((abonnement) =>
          isSameDay(new Date(abonnement.createdAt), selectedDate)
        )
        .reduce(
          (acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0),
          0
        ) || 0;

    return dailyJournalsTotal + dailySubscriptionsTotal;
  }, [journals, abonnementsData, selectedDate]);

  const netTotal = useMemo(
    () => cashTotal - dailyExpensesTotal,
    [cashTotal, dailyExpensesTotal]
  );

  const dailySalesTotal = useMemo(() => {
    if (!dailyProducts || !products) return 0;
    return dailyProducts.reduce((total, dailyProduct) => {
      const product = products.find((p) => p.id === dailyProduct.productId);
      return (
        total + (product ? product.sellingPrice * dailyProduct.quantite : 0)
      );
    }, 0);
  }, [dailyProducts, products]);

  const dailySoldItemsCount = useMemo(() => {
    if (!dailyProducts) return 0;
    return dailyProducts.reduce((acc, curr) => acc + curr.quantite, 0);
  }, [dailyProducts]);

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDailyExpense(id).unwrap();
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  const handleUpdateExpense = (expense: DailyExpense) => {
    setSelectedExpense(expense);
    setOpenUpdateModal(true);
  };

  const handleUpdateSubmit = async (data: {
    expenseId: string;
    date?: string;
    Summary?: string;
  }) => {
    if (!selectedExpense) return;
    try {
      await updateDailyExpense({
        id: selectedExpense.id,
        data: {
          expenseId: data.expenseId,
          Summary: data.Summary || undefined,
          date: data.date
            ? format(new Date(data.date), "yyyy-MM-dd")
            : undefined,
        },
      }).unwrap();
      setOpenUpdateModal(false);
      setSelectedExpense(null);
    } catch (error) {
      console.error("Failed to update expense:", error);
    }
  };

  if (isLoading || isLoadingAbonnements || isLoadingProducts) {
    return <p>Loading...</p>;
  }

  if (errorMemberReq || errorAbonnements || errorProducts) {
    return <p>Error loading data</p>;
  }

  return (
    <React.Fragment>
      <Grid container spacing={6}>
        {/* First Row */}
        <Grid container item spacing={6}>
          <Grid item xs={12} sm={12} md={6} lg={4} xl>
            <Stats
              title="Daily Members"
              count={dailyMembersCount}
              icon={<User />}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={6} lg={4} xl>
            <Stats
              title="Daily Membership"
              count={dailySubscribedMembersCount}
              icon={<CreditCard />}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={6} lg={4} xl>
            <Stats
              title="Daily Expense"
              count={dailyExpensesTotal}
              icon={<TrendingUp />}
            />
          </Grid>
        </Grid>
        {/* Second Row */}
        <Grid container item spacing={6}>
          <Grid item xs={12} sm={12} md={6} lg={4} xl>
            <Stats
              title="Total Sales"
              count={parseFloat(dailySalesTotal.toFixed(2))}
              icon={<DollarSign />}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={6} lg={4} xl>
            <Stats title="Daily Cash" count={cashTotal} icon={<DollarSign />} />
          </Grid>
          <Grid item xs={12} sm={12} md={6} lg={4} xl>
            <Stats
              title="Items sold"
              count={dailySoldItemsCount}
              icon={<ShoppingCart />}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={6} lg={3} xl>
            <Stats title="Net" count={netTotal} icon={<Activity />} />
          </Grid>
        </Grid>
      </Grid>
      <Box mt={4}>
        <Typography variant="h6" mb={2}>
          Daily Products ({format(selectedDate, "dd/MM/yyyy")})
        </Typography>
        <Grid container spacing={3}>
          {products
            ?.slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((product) => {
              const dailyProduct = dailyProducts?.find(
                (dp) => dp.productId === product.id
              );
              const quantity = dailyProduct?.quantite || 0;
              const isOutOfStock = product.stock <= 0;

              return (
                <Grid item key={product.id} xs={12} sm={6} md={4} lg={3}>
                  <ProductCard>
                    <ProductMedia>
                      {product.img ? (
                        <img
                          src={product.img}
                          alt={product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 80,
                            height: 80,
                            bgcolor: "primary.main",
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
                    <ProductContent>
                      <Typography gutterBottom variant="h6">
                        {product.name}
                      </Typography>
                      <ProductPrice variant="h6">
                        {product.sellingPrice.toFixed(2)} DT
                      </ProductPrice>
                      <Typography variant="body2" color="text.secondary">
                        Quantity Sold: {quantity}
                      </Typography>
                    </ProductContent>
                    <CardActions sx={{ justifyContent: "space-between", p: 2 }}>
                      <IconButton
                        color="secondary"
                        onClick={() => handleQuantityChange(product.id, false)}
                        disabled={quantity <= 0}
                        title={
                          quantity <= 0
                            ? "Aucun produit à retirer"
                            : "Retirer un produit"
                        }
                      >
                        <RemoveIcon />
                      </IconButton>
                      <IconButton
                        color="primary"
                        onClick={() => handleQuantityChange(product.id, true)}
                        disabled={isOutOfStock}
                        title={
                          isOutOfStock ? "Stock épuisé" : "Ajouter un produit"
                        }
                      >
                        <AddIcon />
                      </IconButton>
                    </CardActions>
                  </ProductCard>
                </Grid>
              );
            })}
        </Grid>
      </Box>
      <Box mt={4}>
        <Typography variant="h6" mb={2}>
          Daily Expenses ({format(selectedDate, "dd/MM/yyyy")})
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Amount (DT)</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyExpenses.length > 0 ? (
                dailyExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.expense.name}</TableCell>
                    <TableCell>{expense.expense.amount.toFixed(2)}</TableCell>
                    <TableCell>{expense.expense.description || "-"}</TableCell>
                    <TableCell>{expense.Summary || "-"}</TableCell>
                    <TableCell>
                      {format(
                        new Date(expense.date || expense.createdAt),
                        "dd/MM/yyyy HH:mm"
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleUpdateExpense(expense)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteExpense(expense.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No expenses recorded for this date.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      {selectedExpense && (
        <DailyExpenseModal
          open={openUpdateModal}
          onClose={() => {
            setOpenUpdateModal(false);
            setSelectedExpense(null);
          }}
          expenses={expenses.map((expense) => ({
            ...expense,
            type: expense.type as ExpenseType,
          }))}
          onSubmit={handleUpdateSubmit}
          initialData={{
            expenseId: selectedExpense.expenseId,
            date: selectedExpense.date,
            Summary: selectedExpense.Summary,
          }}
        />
      )}
    </React.Fragment>
  );
}

export default JournalDetails;
