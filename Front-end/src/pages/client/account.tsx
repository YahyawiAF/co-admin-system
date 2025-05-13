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
import {
  Tooltip,
  Snackbar,
  Alert,
  Button,
  TextField,
  Card,
  CardHeader,
  Divider,
  CardContent,
  CardActions,
} from "@mui/material";
import PublicLayout from "src/layouts/PublicLayout";
import { AccountDetailsForm } from "src/components/pages/dashboard/account/AccountDetailsForm";
import { AccountInfo } from "src/components/pages/dashboard/account/AccountInfo";
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import { useUpdateUserMutation } from "src/api/user.repo";
import { useChangePasswordMutation } from "src/api/user.repo";
import "./globals.css";

export const metadata: Metadata = {
  title: `Account Settings | Dashboard | Collabora`,
  description: "Manage your account information and settings",
};

function Account(): React.JSX.Element {
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const [updateUser] = useUpdateUserMutation();
  const [userData, setUserData] = React.useState<{
    username: string;
    role: string;
    email?: string;
    phone?: string;
  }>({ username: "", role: "" });
  const [notification, setNotification] = React.useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const storedData = {
        username: sessionStorage.getItem("username") || "",
        role: sessionStorage.getItem("Role") || "USER",
        email: sessionStorage.getItem("email") || undefined,
        phone: sessionStorage.getItem("phone") || undefined,
      };
      setUserData(storedData);
    }
  }, []);
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [changePassword] = useChangePasswordMutation();
  const [passwords, setPasswords] = React.useState({
    oldPassword: "",
    newPassword: "",
  });
  const handleChangePassword = async () => {
    try {
      await changePassword({
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword,
      }).unwrap();

      setNotification({
        open: true,
        message: "Mot de passe changé avec succès !",
        severity: "success",
      });

      setPasswords({ oldPassword: "", newPassword: "" });
    } catch (error: any) {
      console.error("Erreur lors du changement de mot de passe:", error);
      setNotification({
        open: true,
        message:
          error?.data?.message || "Erreur lors du changement de mot de passe.",
        severity: "error",
      });
    }
  };

  const handleUpdateUser = async (updateData: {
    username: string;
    email?: string;
    phone?: string;
  }) => {
    const userId = sessionStorage.getItem("userID");
    if (!userId) {
      setNotification({
        open: true,
        message: "Utilisateur non authentifié.",
        severity: "error",
      });
      return;
    }

    try {
      // 1. Conversion des noms de champs frontend -> backend
      const backendData: any = {
        fullname: updateData.username,
        phoneNumber: updateData.phone,
      };

      // Si l'email est défini, on l'ajoute aux données envoyées, sinon on ne l'ajoute pas
      if (updateData.email) {
        backendData.email = updateData.email;
      }

      // 2. Appel API avec vérification de type explicite
      const updatedUser = await updateUser({
        id: userId,
        data: backendData,
      }).unwrap();

      // 3. Mise à jour sessionStorage avec vérification de type
      sessionStorage.setItem("username", updatedUser.fullname || "");
      if (updatedUser.email) {
        sessionStorage.setItem("email", updatedUser.email);
      }
      if (updatedUser.phoneNumber) {
        sessionStorage.setItem("phone", updatedUser.phoneNumber);
      }

      // 4. Mise à jour du state avec typage strict
      setUserData((prev) => ({
        ...prev,
        username: updatedUser.fullname || prev.username,
        email: updatedUser.email || prev.email,
        phone: updatedUser.phoneNumber || prev.phone,
      }));

      // 5. Notification de succès
      setNotification({
        open: true,
        message: "Profil mis à jour avec succès !",
        severity: "success",
      });
    } catch (error: any) {
      console.error("Erreur de mise à jour :", error);

      // 6. Gestion d'erreur améliorée
      const errorMessage = error?.data?.message?.toLowerCase() || "";
      const statusCode = error?.status;

      let notificationMessage =
        "Échec de la mise à jour du profil. Veuillez réessayer.";

      if (statusCode === 400 || statusCode === 409) {
        if (
          errorMessage.includes("nom d'utilisateur") ||
          errorMessage.includes("fullname")
        ) {
          notificationMessage = "Ce nom d'utilisateur est déjà pris.";
        } else if (errorMessage.includes("email")) {
          notificationMessage = "Cet email est déjà utilisé.";
        } else if (
          errorMessage.includes("téléphone") ||
          errorMessage.includes("numéro")
        ) {
          notificationMessage = "Ce numéro de téléphone est déjà utilisé.";
        }
      }

      setNotification({
        open: true,
        message: notificationMessage,
        severity: "error",
      });
    }
  };

  const handleSignOut = async () => {
    const accessToken = sessionStorage.getItem("accessToken");
    const Role = sessionStorage.getItem("Role");
    const username = sessionStorage.getItem("username");

    if (!accessToken) {
      router.replace("/client/login");
      return;
    }

    try {
      await logout().unwrap();
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("userID");
      sessionStorage.removeItem("email");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("Role");
      sessionStorage.removeItem("phone");
      sessionStorage.removeItem("role");

      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Déconnexion échouée:", error);
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("userID");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("email");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("Role");
      sessionStorage.removeItem("phone");
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box
      sx={{
        p: 3,
        minHeight: "100vh", // ✅ pour prendre toute la hauteur visible
        overflowY: "auto", // ✅ scroll si contenu trop long
      }}
    >
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>

      <Stack spacing={3}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
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
                  onUpdate={handleUpdateUser}
                  phoneDisabled={true}
                />
                <Box sx={{ mt: 4 }}>
                  <Card
                    sx={{
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <CardHeader
                      title="Change Password"
                      subheader="Update your password securely"
                    />
                    <Divider />

                    <CardContent>
                      <Grid container spacing={3}>
                        {/* Old Password */}
                        <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                          <TextField
                            type="password"
                            label="Old password"
                            variant="outlined"
                            value={passwords.oldPassword}
                            onChange={(e) =>
                              setPasswords((prev) => ({
                                ...prev,
                                oldPassword: e.target.value,
                              }))
                            }
                            fullWidth
                          />
                        </Grid>

                        {/* Espacement vertical sur mobile */}
                        <Grid
                          item
                          xs={12}
                          sx={{
                            display: { xs: "block", sm: "none" },
                            height: 16,
                          }}
                        />

                        {/* New Password */}
                        <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                          <TextField
                            type="password"
                            label="New password"
                            variant="outlined"
                            value={passwords.newPassword}
                            onChange={(e) =>
                              setPasswords((prev) => ({
                                ...prev,
                                newPassword: e.target.value,
                              }))
                            }
                            fullWidth
                          />
                        </Grid>

                        {/* Confirm Password */}
                        <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                          <TextField
                            type="password"
                            label="Confirm new password"
                            variant="outlined"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            fullWidth
                          />
                        </Grid>

                        {/* Message d'erreur intégré */}
                        {passwords.newPassword &&
                          confirmPassword &&
                          passwords.newPassword !== confirmPassword && (
                            <Grid item xs={12}>
                              <Typography
                                color="error"
                                variant="body2"
                                sx={{ mt: 1 }}
                              >
                                Les mots de passe ne correspondent pas
                              </Typography>
                            </Grid>
                          )}
                      </Grid>
                    </CardContent>

                    {/* Divider ajouté après CardContent */}
                    <Divider />

                    {/* CardActions pour le bouton */}
                    <CardActions
                      sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}
                    >
                      {" "}
                      <Button
                        variant="contained"
                        type="button"
                        disabled={
                          !passwords.oldPassword ||
                          !passwords.newPassword ||
                          !confirmPassword ||
                          passwords.newPassword !== confirmPassword
                        }
                        onClick={() => {
                          if (passwords.newPassword !== confirmPassword) {
                            setNotification({
                              open: true,
                              message:
                                "Les mots de passe ne correspondent pas.",
                              severity: "error",
                            });
                            return;
                          }
                          handleChangePassword();
                        }}
                      >
                        Save changes
                      </Button>
                    </CardActions>
                  </Card>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      </Stack>
    </Box>
  );
}

Account.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
      {" "}
      <RoleProtectedRoute allowedRoles={["USER"]}>{page} </RoleProtectedRoute>
    </PublicLayout>
  );
};

export default Account;
