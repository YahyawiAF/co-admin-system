// src/components/pages/dashboard/journal/JournalDetails.tsx
import React, { useMemo, useState } from "react";
import styled from "@emotion/styled";
import { useTranslation } from "react-i18next";
import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  IconButton,
} from "@mui/material";
import { spacing } from "@mui/system";
import {
  DollarSign,
  CreditCard,
  User,
  TrendingUp,
  Activity,
} from "react-feather";
import { format } from "date-fns";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Stats from "../landing/stats";
import { Journal, DailyExpense, ExpenseType } from "src/types/shared";
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import {
  useDeleteDailyExpenseMutation,
  useUpdateDailyExpenseMutation,
} from "src/api/dailyexpenseApi";
import DailyExpenseModal from "src/components/pages/dashboard/journal/dailyexpense";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

interface JournalDetailsProps {
  journals: Journal[];
  dailyExpenses: DailyExpense[];
  isLoading: boolean;
  errorMemberReq: boolean;
  selectedDate: Date;
  expenses: Array<{ id: string; name: string; amount: number; type: string }>;
}

function JournalDetails({
  journals,
  dailyExpenses,
  isLoading,
  errorMemberReq,
  selectedDate,
  expenses = [], // Default to empty array
}: JournalDetailsProps) {
  const { t } = useTranslation();
  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements,
  } = useGetAbonnementsQuery({ search: "" });
  const [deleteDailyExpense] = useDeleteDailyExpenseMutation();
  const [updateDailyExpense] = useUpdateDailyExpenseMutation();

  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<DailyExpense | null>(
    null
  );

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const filteredDailyExpenses = useMemo(() => {
    return dailyExpenses.filter((expense) => {
      const expenseDate = new Date(expense.date || expense.createdAt);
      return isSameDay(expenseDate, selectedDate);
    });
  }, [dailyExpenses, selectedDate]);

  const dailyExpensesTotal = useMemo(() => {
    return filteredDailyExpenses.reduce(
      (acc, curr) => acc + curr.expense.amount,
      0
    );
  }, [filteredDailyExpenses]);

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
  const netTotal = useMemo(() => {
    return cashTotal - dailyExpensesTotal;
  }, [cashTotal, dailyExpensesTotal]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDailyExpense(id).unwrap();
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  const handleUpdate = (expense: DailyExpense) => {
    setSelectedExpense(expense);
    setOpenUpdateModal(true);
  };

  const handleUpdateSubmit = async (data: {
    expenseId: string;
    date?: string;
  }) => {
    if (!selectedExpense) return;
    try {
      await updateDailyExpense({
        id: selectedExpense.id,
        data: {
          expenseId: data.expenseId,
          date: data.date
            ? format(new Date(data.date), "yyyy-MM-dd")
            : undefined, // Ensure correct date format
        },
      }).unwrap();
      setOpenUpdateModal(false);
      setSelectedExpense(null);
    } catch (error) {
      console.error("Failed to update expense:", error);
    }
  };

  if (isLoading || isLoadingAbonnements) return <p>Loading</p>;
  if (errorMemberReq || errorAbonnements) return <p>Error!</p>;

  return (
    <React.Fragment>
      <Grid container spacing={6}>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Daily Membres"
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
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Daily Cash" count={cashTotal} icon={<DollarSign />} />
        </Grid>
      </Grid>
      <Grid item xs={12} sm={12} md={6} lg={3} xl>
        <Stats title="Net" count={netTotal} icon={<Activity />} />
      </Grid>
      <Box mt={4}>
        <Typography variant="h6" mb={2}>
          Daily Expenses ({format(selectedDate, "dd/MM/yyyy")})
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "20%" }}>Name</TableCell>
                <TableCell sx={{ width: "15%" }}>Amount (DT)</TableCell>
                <TableCell sx={{ width: "30%" }}>Description</TableCell>
                <TableCell sx={{ width: "20%" }}>Date</TableCell>
                <TableCell sx={{ width: "15%" }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDailyExpenses.length > 0 ? (
                filteredDailyExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.expense.name}</TableCell>
                    <TableCell>{expense.expense.amount.toFixed(2)}</TableCell>
                    <TableCell>{expense.expense.description || "-"}</TableCell>
                    <TableCell>
                      {format(
                        new Date(expense.date || expense.createdAt),
                        "dd/MM/yyyy HH:mm"
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleUpdate(expense)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(expense.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
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
            type: expense.type as ExpenseType, // Cast type to ExpenseType
          }))} // Map and cast expenses
          onSubmit={handleUpdateSubmit}
          initialData={{
            expenseId: selectedExpense.expenseId,
            date: selectedExpense.date,
          }}
        />
      )}
    </React.Fragment>
  );
}

export default JournalDetails;
