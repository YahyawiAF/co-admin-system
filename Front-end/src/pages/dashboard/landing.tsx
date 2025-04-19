import React, { useMemo } from "react";
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
import { DollarSign, CreditCard, User } from "react-feather";
import DashboardLayout from "../../layouts/Dashboard";
import LineChart from "src/components/pages/charts/chartjs/LineChart";
import DoughnutChart from "src/components/pages/charts/chartjs/DoughnutChart";
import Stats from "../../components/pages/dashboard/landing/stats";
import { useGetMembersQuery } from "src/api";
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

function Default() {
  const { t } = useTranslation();

  // Fetch members data
  const {
    data: members,
    isLoading: isLoadingMembers,
    error: errorMembers,
  } = useGetMembersQuery();

  // Fetch abonnements data
  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements,
  } = useGetAbonnementsQuery({ search: "" });

  // Calcul des membres abonnés
  const subscribedMembersCount = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    const uniqueMemberIds = new Set(
      abonnementsData.data.map((a) => a.memberID)
    );
    return uniqueMemberIds.size;
  }, [abonnementsData]);

  // Calcul du cash total des abonnements
  const cashTotal = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    return abonnementsData.data.reduce(
      (acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0),
      0
    );
  }, [abonnementsData]);

  // Gestion des états de chargement et d'erreur
  if (isLoadingMembers || isLoadingAbonnements) return <p>Loading</p>;
  if (errorMembers || errorAbonnements) return <p>Error!</p>;

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
          <Stats
            title="Daily Members"
            count={members?.length || 0}
            icon={<User />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Members Subscribed"
            count={subscribedMembersCount}
            icon={<CreditCard />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Cash" count={cashTotal} icon={<DollarSign />} />
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
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default Default;
