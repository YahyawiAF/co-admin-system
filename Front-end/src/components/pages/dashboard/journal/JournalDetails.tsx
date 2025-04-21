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
import { Journal, Expenses } from "src/types/shared"; // Ajoutez l'import Expenses
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import { ExpenseType } from "src/types/shared";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

interface JournalDetailsProps {
  journals: Journal[];
  dailyExpenses: Expenses[]; // Ajoutez cette interface
  isLoading: boolean;
  errorMemberReq: boolean;
}

function JournalDetails({
  journals,
  dailyExpenses,  // Ajoutez cette prop
  isLoading,
  errorMemberReq,
}: JournalDetailsProps) { // Utilisez l'interface définie
  const { t } = useTranslation();
  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements,
  } = useGetAbonnementsQuery({ search: "" });

  const dailyExpensesTotal = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return dailyExpenses
      .filter(expense => {
        const expenseDate = new Date(expense.createdAt).toLocaleDateString('en-CA');
        return expenseDate === today;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [dailyExpenses]); // Dépendance sur dailyExpenses

  // Calcul des membres abonnés
  const subscribedMembersCount = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    const uniqueMemberIds = new Set(
      abonnementsData.data.map((a) => a.memberID)
    );
    return uniqueMemberIds.size;
  }, [abonnementsData]);

  // Calcul du total des paiements pour les abonnements
  const cashSubscribedTotal = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    return abonnementsData.data.reduce(
      (acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0),
      0
    );
  }, [abonnementsData]);

  // Calcul du cash total
  const cashTotal = useMemo(
    () =>
      journals.reduce(
        (acc, curr) => (curr.isPayed ? acc + (curr.payedAmount || 0) : acc),
        0
      ) + cashSubscribedTotal,
    [journals, cashSubscribedTotal]
  );

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
            count={subscribedMembersCount}
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
          <Stats
            title="Cash"
            count={cashTotal}
            icon={<DollarSign />}

          />
        </Grid>
      </Grid>
    </React.Fragment>
  );
}

export default JournalDetails;