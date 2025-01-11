import * as React from "react";
import type { ReactElement } from "react";
import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";

// import { config } from '@/config';
import { AccountDetailsForm } from "src/components/pages/dashboard/account/AccountDetailsForm";
import { AccountInfo } from "src/components/pages/dashboard/account/AccountInfo";
import PublicLayout from "src/layouts/PublicLayout";

export const metadata = {
  title: `Account | Dashboard | Collabora`,
} satisfies Metadata;

function Account(): React.JSX.Element {
  return (
    <Grid container spacing={3}>
      <Grid lg={4} md={6} xs={12}>
        <AccountInfo />
      </Grid>
      <Grid lg={8} md={6} xs={12}>
        <AccountDetailsForm />
      </Grid>
    </Grid>
  );
}

Account.getLayout = function getLayout(page: ReactElement) {
  return <PublicLayout>{page}</PublicLayout>;
};

export default Account;
