import React, { useMemo } from "react";
import type { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  Box,
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
  Paper,
} from "@mui/material";
import { spacing } from "@mui/system";
import { DollarSign, CreditCard, User } from "react-feather";
import DashboardLayout from "../../layouts/Dashboard";
import LineChart from "src/components/pages/charts/chartjs/LineChart";
import DoughnutChart from "src/components/pages/charts/chartjs/DoughnutChart";
import Stats from "../../components/pages/dashboard/landing/stats";
import { useGetMembersQuery } from "src/api";
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

function Default() {
  const { t } = useTranslation();
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const mobileUrl = `${appUrl}/m`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mobileUrl)}`;

  const {
    data: members,
    isLoading: isLoadingMembers,
    error: errorMembers,
  } = useGetMembersQuery();

  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements,
  } = useGetAbonnementsQuery({ search: "" });

  const subscribedMembersCount = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    const uniqueMemberIds = new Set(
      abonnementsData.data.map((a) => a.memberID)
    );
    return uniqueMemberIds.size;
  }, [abonnementsData]);

  const cashTotal = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    return abonnementsData.data.reduce(
      (acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0),
      0
    );
  }, [abonnementsData]);

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

      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="h6" gutterBottom>
              Visitor QR (mobile check-in)
            </Typography>
            <Box
              component="img"
              src={qrSrc}
              alt="QR code to /m"
              sx={{ width: 200, height: 200, mx: "auto", display: "block" }}
            />
            <Typography variant="body2" sx={{ mt: 1, wordBreak: "break-all" }}>
              {mobileUrl}
            </Typography>
          </Paper>
        </Grid>
        <Grid display={"flex"} item xs={12} md={4}>
          <DoughnutChart />
        </Grid>
        <Grid item xs={12} md={4}>
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
