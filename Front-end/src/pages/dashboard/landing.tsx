import React from "react";
import type { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing } from "@mui/system";

import DashboardLayout from "../../layouts/Dashboard";

import LineChart from "src/components/pages/charts/chartjs/LineChart";
import DoughnutChart from "src/components/pages/charts/chartjs/DoughnutChart";

// import DoughnutTopTransactions from "../../components/pages/dashboard/landing/DoughnutTopTransactions";

import Stats from "../../components/pages/dashboard/landing/stats";
// import Table from "../../components/pages/dashboard/landing/Table";
import { DollarSign, CreditCard, User } from "react-feather";
import { useGetMembersQuery } from "src/api";
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

const Divider = styled(MuiDivider)(spacing);

const Typography = styled(MuiTypography)(spacing);

function Default() {
  const { t } = useTranslation();
  const {
    data: members,
    isLoading,
    error: errorMemberReq,
  } = useGetMembersQuery();
  const cards = [];
  if (isLoading) return <p>Loading</p>;
  if (errorMemberReq) return <p>error!</p>;
  return (


    <React.Fragment>
      <Helmet title="Default Dashboard" />
      <Grid justifyContent="space-between" container spacing={6}>
        <Grid item>
          <Typography variant="h3">
            {t("Welcome back")}, User! {t("We've missed you")}.{" "}
          </Typography>
        </Grid>
      </Grid>

      <Divider my={6} />

      <Grid container spacing={6}>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Members" count={members?.length || 0} icon={<User />} />
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
    </React.Fragment>

  );
}

Default.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout><RoleProtectedRoute allowedRoles={['ADMIN']}>{page} </RoleProtectedRoute></DashboardLayout>;
};

export default Default;
