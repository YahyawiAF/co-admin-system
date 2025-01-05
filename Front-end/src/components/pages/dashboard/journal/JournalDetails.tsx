import React, { useMemo } from "react";
import styled from "@emotion/styled";
import { useTranslation } from "react-i18next";

import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing } from "@mui/system";

// import LineChart from "src/components/pages/charts/chartjs/LineChart";
// import DoughnutChart from "src/components/pages/charts/chartjs/DoughnutChart";

import { DollarSign, CreditCard, User } from "react-feather";
import Stats from "../landing/stats";
import { Journal } from "src/types/shared";

const Divider = styled(MuiDivider)(spacing);

const Typography = styled(MuiTypography)(spacing);

function JournalDetails({
  journals,
  isLoading,
  errorMemberReq,
}: {
  journals: Array<Journal>;
  isLoading: boolean;
  errorMemberReq: boolean;
}) {
  const Members = journals.length;
  const cashTotal = useMemo(
    () => journals.reduce((acc, curr) => (curr.isPayed ? acc + 4 : acc), 0),
    [journals]
  );
  if (isLoading) return <p>Loading</p>;
  if (errorMemberReq) return <p>error!</p>;
  return (
    <React.Fragment>
      <Grid container spacing={6}>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Members"
            count={journals?.length || 0}
            icon={<User />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Member Subscibed" count={0} icon={<CreditCard />} />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats title="Cash" count={cashTotal} icon={<DollarSign />} />
        </Grid>
      </Grid>

      {/* <Grid container spacing={4}>
        <Grid display={"flex"} item xs={12} lg={6}>
          <DoughnutChart />
        </Grid>
        <Grid item xs={12} lg={6}>
          <LineChart />
        </Grid>
      </Grid> */}
      {/* <Grid container spacing={6}>
        <Grid item xs={12} lg={6}>
          <Table transactions={transactions} />
        </Grid>
        <Grid item xs={12} lg={6}>
          <DoughnutTopTransactions transactions={transactions} />
        </Grid>
      </Grid> */}
    </React.Fragment>
  );
}
export default JournalDetails;
