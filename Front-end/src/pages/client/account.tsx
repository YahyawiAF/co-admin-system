import * as React from "react";
import type { ReactElement } from "react";
import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";

import { AccountDetailsForm } from "src/components/pages/dashboard/account/AccountDetailsForm";
import { AccountInfo } from "src/components/pages/dashboard/account/AccountInfo";
import PublicLayout from "src/layouts/PublicLayout";

export const metadata: Metadata = {
  title: `Account Settings | Dashboard | Collabora`,
  description: "Manage your account information and settings",
};

function Account(): React.JSX.Element {
  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1" fontWeight="medium">
          Account Settings
        </Typography>
        
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <Grid container spacing={4}>
            <Grid item lg={4} md={6} xs={12}>
              <AccountInfo />
            </Grid>
            
            <Grid item lg={8} md={6} xs={12}>
              <Stack spacing={3}>
                <Typography variant="h6" component="h2">
                  Profile Details
                </Typography>
                <AccountDetailsForm />
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      </Stack>
    </Box>
  );
}

Account.getLayout = function getLayout(page: ReactElement) {
  return <PublicLayout>{page}</PublicLayout>;
};

export default Account;