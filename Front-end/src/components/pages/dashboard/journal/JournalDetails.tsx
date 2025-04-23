import React, { useMemo } from "react";
import styled from "@emotion/styled";
import { useTranslation } from "react-i18next";
import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing } from "@mui/system";
import { DollarSign, CreditCard, User, TrendingUp } from "react-feather";
import Stats from "../landing/stats";
import { Journal, Expenses, DailyExpense } from "src/types/shared"; // Ajoutez l'import Expenses
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import { ExpenseType } from "src/types/shared";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

interface JournalDetailsProps {
  journals: Journal[];
  dailyExpenses: DailyExpense[]; // Ajoutez cette interface
  isLoading: boolean;
  errorMemberReq: boolean;
  selectedDate: Date;
}

function JournalDetails({
  journals,
  dailyExpenses, // Ajoutez cette prop
  isLoading,
  errorMemberReq,

  selectedDate,
}: JournalDetailsProps) {
  // Utilisez l'interface définie
  const { t } = useTranslation();
  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements,
  } = useGetAbonnementsQuery({ search: "" });
  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };
  const dailyExpensesTotal = useMemo(() => {
    return dailyExpenses.reduce((acc, curr) => {
      const expenseDate = new Date(curr.date || curr.createdAt);
      if (!isSameDay(expenseDate, selectedDate)) return acc;
      return acc + curr.expense.amount;
    }, 0);
  }, [dailyExpenses, selectedDate]);
  // Calcul des membres abonnés
  const dailySubscribedMembersCount = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    return abonnementsData.data.filter(abonnement => {
      const abonnementDate = new Date(abonnement.createdAt);
      return isSameDay(abonnementDate, selectedDate);
    }).length;
  }, [abonnementsData, selectedDate]);

  // Calcul du total des paiements pour les abonnements
  const cashSubscribedTotal = useMemo(() => {
    if (!abonnementsData?.data) return 0;

    return abonnementsData.data
      .filter(abonnement => {
        const abonnementDate = new Date(abonnement.createdAt);
        return isSameDay(abonnementDate, selectedDate);
      })
      .reduce((acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0), 0);
  }, [abonnementsData, selectedDate]);

  // Calcul du cash total
  const cashTotal = useMemo(() => {
    return (
      journals
        .filter(journal => isSameDay(new Date(journal.registredTime), selectedDate))
        .reduce((acc, curr) => (curr.isPayed ? acc + (curr.payedAmount || 0) : acc), 0)
      +
      (abonnementsData?.data
        ?.filter(abonnement => isSameDay(new Date(abonnement.createdAt), selectedDate))
        .reduce((acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0), 0) || 0)
    );
  }, [journals, abonnementsData, selectedDate]);
  if (isLoading || isLoadingAbonnements) return <p>Loading</p>;
  if (errorMemberReq || errorAbonnements) return <p>Error!</p>;

  return (
    <React.Fragment>
      <Grid container spacing={6}>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Daily Membres"
            count={journals?.length || 0}
            icon={<User />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Membership"
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
          <Stats title="Cash" count={cashTotal} icon={<DollarSign />} />
        </Grid>
      </Grid>
    </React.Fragment>
  );
}

export default JournalDetails;
