import React, { useState, useEffect } from "react";
import {
  useGetUserByIdQuery,
  useUpdateUserMutation,
  useChangePasswordMutation,
} from "src/api/user.repo";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  CircularProgress,
  Container,
  Grid,
  Alert,
  Snackbar,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Email as EmailIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import DashboardLayout from "src/layouts/Dashboard";
import { User } from "src/types/shared";
import imageCompression from "browser-image-compression";

const AdminProfile = () => {
  // Get the ID of the logged-in user from sessionStorage
  const userId = sessionStorage.getItem("userID") || "";

  // Query to get user information
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useGetUserByIdQuery(userId, {
    skip: !userId, // Skip the query if userId is not available
  });

  // Mutation to update user
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

  // Mutation to change password
  const [changePassword, { isLoading: isChangingPassword }] =
    useChangePasswordMutation();

  // Form states
  const [formData, setFormData] = useState<Partial<User>>({
    fullname: "",
    email: "",
    phoneNumber: "",
    img: "",
  });

  const [originalData, setOriginalData] = useState<Partial<User>>({
    fullname: "",
    email: "",
    phoneNumber: "",
    img: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  // Initialize form data when user is loaded
  useEffect(() => {
    if (user) {
      const userData = {
        fullname: user.fullname || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        img: user.img || "",
      };

      setFormData(userData);
      setOriginalData(userData);
    }
  }, [user]);

  // Function to compress and upload an image
  const compressAndUploadImage = async (file: File): Promise<string> => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only JPG, PNG, and WEBP formats are accepted");
    }

    const MAX_FILE_SIZE_MB = 3;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`Image must not exceed ${MAX_FILE_SIZE_MB}MB`);
    }

    const options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.6,
    };

    try {
      const compressedFile = await imageCompression(file, options);

      if (compressedFile.size > 200 * 1024) {
        throw new Error("Compressed image is still too large");
      }

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(compressedFile);
      });
    } catch (error) {
      console.error("Compression error:", error);
      throw new Error("Image compression failed");
    }
  };

  // Handle avatar change
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    try {
      setIsUploading(true);
      const imageUrl = await compressAndUploadImage(file);

      // Update avatar in database using the correct field name 'img'
      await updateUser({
        id: userId,
        data: { img: imageUrl },
      }).unwrap();

      // Update formData to reflect the new image
      setFormData((prev) => ({ ...prev, img: imageUrl }));
      setSnackbar({
        open: true,
        message: "Profile picture updated successfully!",
        severity: "success",
      });

      // Refetch user data to ensure consistency
      await refetch();
    } catch (error: any) {
      console.error("Error updating avatar:", error);
      setSnackbar({
        open: true,
        message:
          error.data?.message || error.message || "Failed to update photo",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle form changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  // Toggle password visibility
  const handleClickShowPassword = (field: keyof typeof showPassword) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Check if profile data has changed
  const hasProfileChanged = () => {
    return (
      formData.fullname !== originalData.fullname ||
      formData.email !== originalData.email ||
      formData.phoneNumber !== originalData.phoneNumber ||
      formData.img !== originalData.img
    );
  };

  // Submit profile changes
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Check if anything has changed
    if (!hasProfileChanged()) {
      setSnackbar({
        open: true,
        message: "No changes detected to update",
        severity: "info",
      });
      return;
    }

    try {
      // Prepare update data with only changed fields
      const updateData: Partial<User> = {};

      if (formData.fullname !== originalData.fullname) {
        updateData.fullname = formData.fullname;
      }

      if (formData.email !== originalData.email) {
        updateData.email = formData.email;
      }

      if (formData.phoneNumber !== originalData.phoneNumber) {
        updateData.phoneNumber = formData.phoneNumber;
      }

      if (formData.img !== originalData.img) {
        updateData.img = formData.img;
      }

      // Only send update if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateUser({
          id: userId,
          data: updateData,
        }).unwrap();
      }

      setSnackbar({
        open: true,
        message: "Profile updated successfully!",
        severity: "success",
      });

      // Update original data to current values
      setOriginalData(formData);

      // Refetch user data
      await refetch();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setSnackbar({
        open: true,
        message:
          error.data?.message || error.message || "Failed to update profile",
        severity: "error",
      });
    }
  };

  // Submit password change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setSnackbar({
        open: true,
        message: "Passwords do not match",
        severity: "error",
      });
      return;
    }

    try {
      // Use the changePassword mutation
      await changePassword({
        oldPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      }).unwrap();

      setSnackbar({
        open: true,
        message: "Password updated successfully!",
        severity: "success",
      });

      // Reset password form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      console.error("Error changing password:", error);
      setSnackbar({
        open: true,
        message:
          error.data?.message || error.message || "Failed to update password",
        severity: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    console.error("Error loading user:", error);
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Error loading profile:{" "}
          {String(
            "data" in error &&
              typeof error.data === "object" &&
              error.data &&
              "message" in error.data
              ? error.data.message
              : "Unknown error"
          )}
        </Alert>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => refetch()}>
          Try Again
        </Button>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">No user found. Please log in again.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center"></Typography>

        {/* Avatar Section */}
        <Box display="flex" justifyContent="center" mb={4}>
          <Box
            position="relative"
            sx={{ cursor: isUploading ? "default" : "pointer" }}
          >
            <Avatar
              src={formData.img || ""}
              sx={{
                width: 120,
                height: 120,
                border: "3px solid",
                borderColor: "primary.main",
                opacity: isUploading ? 0.6 : 1,
              }}
              onClick={() =>
                !isUploading &&
                document.getElementById("avatar-upload")?.click()
              }
            >
              <PersonIcon sx={{ fontSize: 60 }} />
            </Avatar>

            {isUploading && (
              <CircularProgress
                size={40}
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}

            <input
              accept="image/*"
              style={{ display: "none" }}
              id="avatar-upload"
              type="file"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
            <Typography
              variant="caption"
              display="block"
              textAlign="center"
              sx={{ mt: 1 }}
            ></Typography>
          </Box>
        </Box>

        {/* Profile Form */}
        <form onSubmit={handleProfileSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                name="fullname"
                value={formData.fullname || ""}
                onChange={handleInputChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email || ""}
                onChange={handleInputChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber || ""}
                onChange={handleInputChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isUpdating || !hasProfileChanged()}
                sx={{ mt: 2 }}
              >
                {isUpdating ? <CircularProgress size={24} /> : "Update Profile"}
              </Button>
            </Grid>
          </Grid>
        </form>

        {/* Separator */}
        <Box sx={{ my: 4, borderBottom: 1, borderColor: "divider" }} />

        {/* Password Change Form */}
        <Typography variant="h5" gutterBottom>
          Change Password
        </Typography>

        <form onSubmit={handlePasswordSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Current Password"
                name="currentPassword"
                type={showPassword.current ? "text" : "password"}
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => handleClickShowPassword("current")}
                        edge="end"
                      >
                        {showPassword.current ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password"
                name="newPassword"
                type={showPassword.new ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => handleClickShowPassword("new")}
                        edge="end"
                      >
                        {showPassword.new ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm New Password"
                name="confirmPassword"
                type={showPassword.confirm ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => handleClickShowPassword("confirm")}
                        edge="end"
                      >
                        {showPassword.confirm ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={
                  isChangingPassword ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword
                }
                sx={{ mt: 2 }}
              >
                {isChangingPassword ? (
                  <CircularProgress size={24} />
                ) : (
                  "Change Password"
                )}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

AdminProfile.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default AdminProfile;
