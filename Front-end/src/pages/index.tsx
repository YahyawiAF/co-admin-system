import React from "react";
import type { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import ProtectedRoute from "src/components/auth/ProtectedRoute"; // Ligne ajoutée

import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing } from "@mui/system";

import DashboardLayout from "src/layouts/Dashboard";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

// import LineChart from "src/components/pages/dashboard/landing/LineChart";
// import DoughnutChart from "src/components/pages/dashboard/landing/DoughnutChart";
// import DoughnutTopTransactions from "src/components/pages/dashboard/landing/DoughnutTopTransactions";

// import Stats from "src/components/pages/dashboard/landing/stats";
// import Table from "src/components/pages/dashboard/landing/Table";
// import { DollarSign, CreditCard, User } from "react-feather";
// import { useAppSelector } from "src/redux/hooks";
// import { useGetTransactionsQuery } from "src/api";

const Divider = styled(MuiDivider)(spacing);

const Typography = styled(MuiTypography)(spacing);

function DefaultContent() {  // Nom modifié de Default à DefaultContent
  const { t } = useTranslation();

  // const { data: transaction, isLoading } = useGetTransactionsQuery();
  // const members = useAppSelector((state) => state.members.members);
  // const cards = useAppSelector((state) => state.cards.cards);

  return (
    <React.Fragment>
      <Helmet title="Default Dashboard" />
      <Grid justifyContent="space-between" container spacing={6}>
        <Grid item>
          <Typography variant="h3">
            {t("Welcome back")}, Nick! {t("We've missed you")}.{" "}
          </Typography>
        </Grid>
      </Grid>

      <Divider my={6} />
      {/* 
      <Grid container spacing={6}>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Members" count={members.length} icon={<User />} />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Credit Card"
            count={cards?.length || 0}
            icon={<CreditCard />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Cash" count={3} icon={<DollarSign />} />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid display={"flex"} item xs={12} lg={6}>
          <DoughnutChart />
        </Grid>
        <Grid item xs={12} lg={6}>
          <LineChart />
        </Grid>
      </Grid>
      <Grid container spacing={6}>
        <Grid item xs={12} lg={6}>
          <Table isLoading={isLoading} transactions={transaction} />
        </Grid>
        <Grid item xs={12} lg={6}>
          <DoughnutTopTransactions
            isLoading={isLoading}
            transactions={transaction}
          />
        </Grid>
      </Grid> */}
    </React.Fragment>
  );
}

function Default() {  // Nouveau composant Default qui englobe avec ProtectedRoute
  return (

    <DefaultContent />
  );
}

Default.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout><RoleProtectedRoute allowedRoles={['ADMIN']}>{page}      </RoleProtectedRoute>
  </DashboardLayout>;
};

export default Default;