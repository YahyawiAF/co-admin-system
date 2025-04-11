import * as React from "react";
import type { ReactElement } from "react";
import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import { Power } from "react-feather";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import { Tooltip } from "@mui/material";
import PublicLayout from "src/layouts/PublicLayout";
import { AccountDetailsForm } from "src/components/pages/dashboard/account/AccountDetailsForm";
import { AccountInfo } from "src/components/pages/dashboard/account/AccountInfo";
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

export const metadata: Metadata = {
  title: `Account Settings | Dashboard | Collabora`,
  description: "Manage your account information and settings",
};

function Account(): React.JSX.Element {
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const [userData, setUserData] = React.useState<{
    username: string;
    role: string;
    email?: string;
    phone?: string;
  }>({ username: '', role: '' });

  React.useEffect(() => {
    // Vérifier que nous sommes côté client
    if (typeof window !== 'undefined') {
      const storedData = {
        username: sessionStorage.getItem('username') || '',
        role: sessionStorage.getItem('Role') || 'USER',
        email: sessionStorage.getItem('email') || undefined,
        phone: sessionStorage.getItem('phone') || undefined
      };
      setUserData(storedData);
    }
  }, []);

  const handleSignOut = async () => {
    const accessToken = sessionStorage.getItem('accessToken');
    const Role = sessionStorage.getItem('Role');
    const username = sessionStorage.getItem('username');

    if (!accessToken) {
      router.replace("/client/login");
      return;
    }

    try {
      await logout().unwrap();
      sessionStorage.removeItem('accessToken');
     
      sessionStorage.removeItem('Role');
      sessionStorage.removeItem('username');


      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Déconnexion échouée:", error);
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('role');
      sessionStorage.removeItem('username');
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  return (
    <RoleProtectedRoute allowedRoles={['USER']}>
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" component="h1" fontWeight="medium">
            Account Settings
          </Typography>
          <Tooltip title="Déconnexion">
            <IconButton 
              onClick={handleSignOut}
              color="inherit"
              size="large"
              sx={{ marginLeft: 2 }}
            >
              <Power />
            </IconButton>
          </Tooltip>
        </Stack>

        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
  <Grid container spacing={4}>
    <Grid item lg={4} md={6} xs={12}>
      <AccountInfo 
        name={userData.username}
        email={userData.email}
        phone={userData.phone}
      />
    </Grid>
    
    <Grid item lg={8} md={6} xs={12}>
      <Stack spacing={3}>
        <Typography variant="h6" component="h2">
          Profile Details
        </Typography>
        <AccountDetailsForm 
          username={userData.username}
          email={userData.email}
          phone={userData.phone}
        />
      </Stack>
    </Grid>
    
  </Grid>
</Paper>
      </Stack>
    </Box>
    </RoleProtectedRoute>
  );
}

Account.getLayout = function getLayout(page: ReactElement) {
  return <PublicLayout>{page}</PublicLayout>;
};

export default Account;