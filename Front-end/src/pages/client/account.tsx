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
  CircularProgress,
} from "@mui/material";
import PublicLayout from "src/layouts/PublicLayout";
import { AccountDetailsForm } from "src/components/pages/dashboard/account/AccountDetailsForm";
import { AccountInfo } from "src/components/pages/dashboard/account/AccountInfo";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import { useUpdateUserMutation, useGetUserByIdQuery } from "src/api/user.repo";
import { useChangePasswordMutation } from "src/api/user.repo";

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
    img?: string;
  }>({ username: "", role: "", img: "" });
  const [notification, setNotification] = React.useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [isUploading, setIsUploading] = React.useState(false);

  const userId =
    typeof window !== "undefined" ? sessionStorage.getItem("userID") : null;
  const {
    data: user,
    isLoading,
    error,
  } = useGetUserByIdQuery(userId || "", {
    skip: !userId,
  });

  React.useEffect(() => {
    if (user) {
      sessionStorage.setItem("username", user.fullname || "");
      sessionStorage.setItem("email", user.email || "");
      sessionStorage.setItem("phone", user.phoneNumber || "");
      sessionStorage.setItem("img", user.img || "");
      sessionStorage.setItem("Role", user.role || "USER");

      setUserData({
        username: user.fullname || "",
        role: user.role || "USER",
        email: user.email || undefined,
        phone: user.phoneNumber || undefined,
        img: user.img || undefined,
      });
    } else if (typeof window !== "undefined") {
      const storedData = {
        username: sessionStorage.getItem("username") || "",
        role: sessionStorage.getItem("Role") || "USER",
        email: sessionStorage.getItem("email") || undefined,
        phone: sessionStorage.getItem("phone") || undefined,
        img: sessionStorage.getItem("img") || undefined,
      };
      setUserData(storedData);
    }
  }, [user]);

  React.useEffect(() => {
    if (error) {
      setNotification({
        open: true,
        message: "Error retrieving user data.",
        severity: "error",
      });
    }
  }, [error]);

  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changePassword] = useChangePasswordMutation();
  const [passwords, setPasswords] = React.useState({
    oldPassword: "",
    newPassword: "",
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const uploadedImageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });

      setUserData((prev) => ({ ...prev, img: uploadedImageUrl }));

      sessionStorage.setItem("img", uploadedImageUrl);

      const userId = sessionStorage.getItem("userID");
      if (userId) {
        await updateUser({
          id: userId,
          data: { img: uploadedImageUrl },
        }).unwrap();
      }

      setNotification({
        open: true,
        message: "Profile picture updated successfully!",
        severity: "success",
      });
    } catch (error) {
      console.error("Failed to upload image:", error);
      setNotification({
        open: true,
        message: "Failed to upload image.",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      await changePassword({
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword,
      }).unwrap();

      setNotification({
        open: true,
        message: "Password changed successfully!",
        severity: "success",
      });

      setPasswords({ oldPassword: "", newPassword: "" });
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      setNotification({
        open: true,
        message: error?.data?.message || "Error changing password.",
        severity: "error",
      });
    }
  };

  const handleUpdateUser = async (updateData: {
    username: string;
    email?: string;
    phone?: string;
    img?: string;
  }) => {
    const userId = sessionStorage.getItem("userID");
    if (!userId) {
      setNotification({
        open: true,
        message: "User not authenticated.",
        severity: "error",
      });
      return;
    }

    try {
      const backendData: any = {
        fullname: updateData.username,
        phoneNumber: updateData.phone,
        img: updateData.img || userData.img,
      };

      if (updateData.email) {
        backendData.email = updateData.email;
      }

      const updatedUser = await updateUser({
        id: userId,
        data: backendData,
      }).unwrap();

      sessionStorage.setItem("username", updatedUser.fullname || "");
      if (updatedUser.email) {
        sessionStorage.setItem("email", updatedUser.email);
      }
      if (updatedUser.phoneNumber) {
        sessionStorage.setItem("phone", updatedUser.phoneNumber);
      }
      if (updatedUser.img) {
        sessionStorage.setItem("img", updatedUser.img);
      }

      setUserData((prev) => ({
        ...prev,
        username: updatedUser.fullname || prev.username,
        email: updatedUser.email || prev.email,
        phone: updatedUser.phoneNumber || prev.phone,
        img: updatedUser.img || prev.img,
      }));

      setNotification({
        open: true,
        message: "Profile updated successfully!",
        severity: "success",
      });
    } catch (error: any) {
      console.error("Update error:", error);

      const errorMessage = error?.data?.message?.toLowerCase() || "";
      const statusCode = error?.status;

      let notificationMessage = "Failed to update profile. Please try again.";

      if (statusCode === 400 || statusCode === 409) {
        if (
          errorMessage.includes("username") ||
          errorMessage.includes("fullname")
        ) {
          notificationMessage = "This username is already taken.";
        } else if (errorMessage.includes("email")) {
          notificationMessage = "This email is already in use.";
        } else if (
          errorMessage.includes("phone") ||
          errorMessage.includes("number")
        ) {
          notificationMessage = "This phone number is already in use.";
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
    if (!accessToken) {
      router.replace("/client/login");
      return;
    }

    try {
      await logout().unwrap();
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    } catch (error) {
      console.error("Sign-out failed:", error);
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        minHeight: "100vh",
        overflowY: "auto",
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
          <Tooltip title="Sign Out">
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
                img={userData.img}
                isUploading={isUploading}
                onImageUpload={handleImageUpload}
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
                  img={userData.img}
                  onUpdate={handleUpdateUser}
                  phoneDisabled={true}
                />

                <Box sx={{ mt: 4 }}>
                  <Card sx={{ width: "100%", boxSizing: "border-box" }}>
                    <CardHeader
                      title="Change Password"
                      subheader="Update your password securely"
                    />
                    <Divider />
                    <CardContent>
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                          <TextField
                            type="password"
                            label="Old Password"
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
                        <Grid
                          item
                          xs={12}
                          sx={{
                            display: { xs: "block", sm: "none" },
                            height: 16,
                          }}
                        />
                        <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                          <TextField
                            type="password"
                            label="New Password"
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
                        <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                          <TextField
                            type="password"
                            label="Confirm New Password"
                            variant="outlined"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            fullWidth
                          />
                        </Grid>
                        {passwords.newPassword &&
                          confirmPassword &&
                          passwords.newPassword !== confirmPassword && (
                            <Grid item xs={12}>
                              <Typography
                                color="error"
                                variant="body2"
                                sx={{ mt: 1 }}
                              >
                                Passwords do not match
                              </Typography>
                            </Grid>
                          )}
                      </Grid>
                    </CardContent>
                    <Divider />
                    <CardActions
                      sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}
                    >
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
                              message: "Passwords do not match.",
                              severity: "error",
                            });
                            return;
                          }
                          handleChangePassword();
                        }}
                      >
                        Save Changes
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
      <RoleProtectedRoute allowedRoles={["USER"]}>{page}</RoleProtectedRoute>
    </PublicLayout>
  );
};

export default Account;
