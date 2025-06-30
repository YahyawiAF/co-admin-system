import React, { useState, useEffect, ReactElement } from "react";
import { useTheme, styled } from "@mui/material/styles";
import {
  Box,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  AppBar,
  Toolbar,
  Container,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Avatar,
} from "@mui/material";
import { Power } from "react-feather";
import { CiEdit } from "react-icons/ci";
import { MdOutlineDeleteOutline, MdAddAlert } from "react-icons/md";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import useAuth from "src/hooks/useAuth";
import { FormProvider, useForm } from "react-hook-form";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import PublicLayout from "src/layouts/PublicLayout";
import {
  useGetReclamationsByMemberIdQuery,
  useCreateReclamationMutation,
  useUpdateReclamationMutation,
  useDeleteReclamationMutation,
} from "src/api/reclamationApi";
import { useGetResponsesByClaimsIdQuery } from "src/api/reponseApi";
import RHFTextField from "src/components/hook-form/RHTextField";
import {
  Reclamation,
  ResponseEntity,
  ReclamationStatus,
} from "src/types/shared";

// Form data interface for react-hook-form
interface ReclamationFormData {
  title: string;
  description: string;
  memberId: string;
  status: ReclamationStatus;
}

// Styled components
const ReclamationCard = styled(Box)(({ theme }) => ({
  position: "relative",
  transition: "all 0.3s ease",
  borderRadius: 12,
  background: theme.palette.background.paper,
  border: `2px solid ${theme.palette.primary.main}`,
  boxShadow: theme.shadows[2],
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  "&:hover": {
    transform: "translateY(-8px)",
    boxShadow: theme.shadows[6],
    borderColor: theme.palette.primary.light,
  },
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(3),
  },
}));

const ActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  justifyContent: "flex-end",
  marginTop: theme.spacing(2),
}));

const ReclamationsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(2),
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(2, 1fr)",
  },
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "repeat(3, 1fr)",
  },
}));

const ReclamationManagement = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();

  // State for modals and stepper
  const [activeStep, setActiveStep] = useState(0);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openResponsesDialog, setOpenResponsesDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const steps = ["Enter Details", "Confirm"];

  // State for selected reclamation ID
  const [selectedReclamationId, setSelectedReclamationId] = useState<
    string | null
  >(null);

  // Fetch memberId from sessionStorage
  const memberId = sessionStorage.getItem("member") || "";

  // API hooks
  const {
    data: reclamationsData,
    isLoading,
    isError,
    error,
  } = useGetReclamationsByMemberIdQuery({ memberId }, { skip: !memberId });

  const {
    data: responsesData,
    isLoading: isResponsesLoading,
    isError: isResponsesError,
  } = useGetResponsesByClaimsIdQuery(selectedReclamationId || "", {
    skip: !selectedReclamationId,
  });

  const [
    createReclamation,
    { isLoading: isCreating, isSuccess: isCreateSuccess, error: createError },
  ] = useCreateReclamationMutation();
  const [
    updateReclamation,
    { isLoading: isUpdating, isSuccess: isUpdateSuccess, error: updateError },
  ] = useUpdateReclamationMutation();
  const [
    deleteReclamation,
    { isLoading: isDeleting, isSuccess: isDeleteSuccess, error: deleteError },
  ] = useDeleteReclamationMutation();

  // Form setup for create reclamation
  const createMethods = useForm<ReclamationFormData>({
    defaultValues: {
      title: "",
      description: "",
      memberId: memberId,
      status: ReclamationStatus.PENDING,
    },
  });

  // Form setup for edit reclamation
  const editMethods = useForm<ReclamationFormData>({
    defaultValues: {
      title: "",
      description: "",
      memberId: memberId,
      status: ReclamationStatus.PENDING,
    },
  });

  // Handle sign out
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
      console.error("Déconnexion échouée:", error);
      sessionStorage.clear();
      dispatch(signOut());
      router.replace("/client/login");
    }
  };

  // Handle create dialog
  const handleOpenCreateDialog = () => {
    if (!memberId) {
      setErrorMessage("Member ID is missing. Please log in again.");
      router.replace("/client/login");
      return;
    }
    setOpenCreateDialog(true);
    setActiveStep(0);
    createMethods.reset({
      title: "",
      description: "",
      memberId: memberId,
      status: ReclamationStatus.PENDING,
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    setActiveStep(0);
    createMethods.reset();
  };

  // Handle edit dialog
  const handleOpenEditDialog = (reclamation: Reclamation) => {
    editMethods.reset({
      title: reclamation.title,
      description: reclamation.description,
      memberId: reclamation.memberId || memberId,
      status: reclamation.status,
    });
    setSelectedReclamationId(reclamation.id);
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedReclamationId(null);
    editMethods.reset();
  };

  // Handle delete dialog
  const handleOpenDeleteDialog = (id: string) => {
    setSelectedReclamationId(id);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedReclamationId(null);
  };

  // Handle responses dialog
  const handleOpenResponsesDialog = (id: string) => {
    setSelectedReclamationId(id);
    setOpenResponsesDialog(true);
  };

  const handleCloseResponsesDialog = () => {
    setOpenResponsesDialog(false);
    setSelectedReclamationId(null);
  };

  // Handle create reclamation
  const handleCreateNext = async () => {
    if (activeStep === 0) {
      const isValid = await createMethods.trigger();
      if (!isValid) {
        setErrorMessage("Please fill in all required fields correctly.");
        return;
      }
      setActiveStep(1);
    } else {
      const formData = createMethods.getValues();
      if (!formData.memberId) {
        setErrorMessage("Member ID is required.");
        return;
      }
      try {
        await createReclamation({
          title: formData.title,
          description: formData.description,
          memberId: memberId,
          status: ReclamationStatus.PENDING,
        }).unwrap();
        setSuccessMessage("Reclamation created successfully!");
        setTimeout(() => {
          handleCloseCreateDialog();
        }, 2000);
      } catch (err: any) {
        setErrorMessage(err.data?.message || "Failed to create reclamation.");
      }
    }
  };

  // Handle update reclamation
  const handleUpdate = async () => {
    if (!selectedReclamationId) return;
    const formData = editMethods.getValues();
    if (!formData.memberId) {
      setErrorMessage("Member ID is required.");
      return;
    }
    try {
      await updateReclamation({
        id: selectedReclamationId,
        data: {
          title: formData.title,
          description: formData.description,
          status: formData.status,
        },
      }).unwrap();
      setSuccessMessage("Reclamation updated successfully!");
      setTimeout(() => {
        handleCloseEditDialog();
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.data?.message || "Failed to update reclamation.");
    }
  };

  // Handle delete reclamation
  const handleDelete = async () => {
    if (!selectedReclamationId) return;
    try {
      await deleteReclamation(selectedReclamationId).unwrap();
      setSuccessMessage("Reclamation deleted successfully!");
      handleCloseDeleteDialog();
    } catch (err: any) {
      setErrorMessage(err.data?.message || "Failed to delete reclamation.");
    }
  };

  // Effect for success messages
  useEffect(() => {
    if (isCreateSuccess || isUpdateSuccess || isDeleteSuccess) {
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }
  }, [isCreateSuccess, isUpdateSuccess, isDeleteSuccess]);

  // Redirect to login if no memberId
  useEffect(() => {
    if (!memberId) {
      setErrorMessage("Member ID is missing. Please log in again.");
      router.replace("/client/login");
    }
  }, [memberId, router]);

  if (!memberId) {
    return null;
  }

  if (isLoading) {
    return <CircularProgress sx={{ display: "block", mx: "auto", my: 4 }} />;
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ m: 4 }}>
        {error && "data" in error
          ? (error.data as any)?.message || "Error loading reclamations"
          : "Error loading reclamations"}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Header */}
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1280,
            mx: "auto",
            width: "100%",
            px: { xs: 2, sm: 4 },
          }}
        >
          <Typography
            variant="h5"
            component="h1"
            fontWeight={500}
            sx={{ flexGrow: 1 }}
          >
            Reclamation Management
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Tooltip title="Sign out">
              <IconButton
                onClick={handleSignOut}
                color="inherit"
                sx={{
                  "&:hover": { backgroundColor: theme.palette.action.hover },
                }}
              >
                <Power fontSize="medium" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Account Settings">
              <IconButton
                onClick={() => router.push("/client/account")}
                sx={{
                  p: 0,
                }}
              >
                <Avatar
                  src={sessionStorage.getItem("img") || undefined}
                  alt={sessionStorage.getItem("username") || "User"}
                  sx={{
                    width: 32,
                    height: 32,
                    border: `2px solid ${theme.palette.primary.main}`,
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        maxWidth="lg"
         sx={{ py: { xs: 16, md: 20 }, px: { xs: 2, md: 4 }, borderRadius: 2 }}
      >
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            p: { xs: 2, md: 4 },
          }}
        >
          {successMessage && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: 1 }}>
              {successMessage}
            </Alert>
          )}
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>
              {errorMessage}
            </Alert>
          )}

          {/* Create Reclamation Button */}
          <Box sx={{ mb: 4, textAlign: "right" }}>
            <Tooltip title="Create Reclamation">
              <IconButton
                onClick={handleOpenCreateDialog}
                sx={{
                  py: 1.5,
                  px: 1.5,
                  borderRadius: 8,
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  "&:hover": {
                    backgroundColor: theme.palette.primary.dark,
                  },
                }}
              >
                <MdAddAlert size={20} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Reclamations Grid */}
          <ReclamationsGrid>
            {reclamationsData?.data.length ? (
              reclamationsData.data.map((reclamation) => (
                <ReclamationCard key={reclamation.id}>
                  <Typography variant="h6" gutterBottom>
                    {reclamation.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {reclamation.description}
                  </Typography>
                  <Typography
                    sx={{
                      color:
                        reclamation.status === ReclamationStatus.PENDING
                          ? "#f28c38"
                          : "#4caf50",
                      fontWeight: "medium",
                      mb: 1,
                    }}
                  >
                    Status: {reclamation.status}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Date:{" "}
                    {new Date(reclamation.createdAt).toLocaleString("fr-FR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </Typography>
                  <ActionsContainer>
                    {reclamation.status === ReclamationStatus.RESOLVED ? (
                      <Tooltip title="View Responses">
                        <IconButton
                          onClick={() =>
                            handleOpenResponsesDialog(reclamation.id)
                          }
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Edit">
                          <IconButton
                            onClick={() => handleOpenEditDialog(reclamation)}
                          >
                            <CiEdit size={24} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() =>
                              handleOpenDeleteDialog(reclamation.id)
                            }
                          >
                            <MdOutlineDeleteOutline size={24} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </ActionsContainer>
                </ReclamationCard>
              ))
            ) : (
              <Box sx={{ gridColumn: "span 3", textAlign: "center", py: 4 }}>
                <Typography>No reclamations found.</Typography>
              </Box>
            )}
          </ReclamationsGrid>
        </Paper>
      </Container>

      {/* Create Reclamation Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={handleCloseCreateDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Reclamation</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}
          <FormProvider {...createMethods}>
            {activeStep === 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <RHFTextField name="title" label="Title" required />
                <RHFTextField
                  name="description"
                  label="Description"
                  multiline
                  rows={4}
                  required
                />
                <input
                  type="hidden"
                  {...createMethods.register("memberId")}
                  value={memberId}
                />
                <input
                  type="hidden"
                  {...createMethods.register("status")}
                  value={ReclamationStatus.PENDING}
                />
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Confirm Reclamation Details
                </Typography>
                <Typography>
                  <strong>Title:</strong> {createMethods.getValues("title")}
                </Typography>
                <Typography>
                  <strong>Description:</strong>{" "}
                  {createMethods.getValues("description")}
                </Typography>
              </Box>
            )}
          </FormProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Cancel</Button>
          {activeStep === 0 ? (
            <Button
              variant="contained"
              onClick={handleCreateNext}
              disabled={isCreating}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleCreateNext}
              disabled={isCreating}
            >
              {isCreating ? <CircularProgress size={24} /> : "Confirm"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Reclamation Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Reclamation</DialogTitle>
        <DialogContent>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}
          <FormProvider {...editMethods}>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
            >
              <RHFTextField name="title" label="Title" required />
              <RHFTextField
                name="description"
                label="Description"
                multiline
                rows={4}
                required
              />
              <input type="hidden" {...editMethods.register("memberId")} />
              <input type="hidden" {...editMethods.register("status")} />
            </Box>
          </FormProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? <CircularProgress size={24} /> : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this reclamation? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Responses Dialog */}
      <Dialog
        open={openResponsesDialog}
        onClose={handleCloseResponsesDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Responses for Reclamation</DialogTitle>
        <DialogContent>
          {isResponsesLoading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : isResponsesError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error loading responses
            </Alert>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {responsesData?.length ? (
                responsesData.map((response) => (
                  <Box
                    key={response.id}
                    sx={{
                      p: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                    }}
                  >
                    <Typography>{response.content}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Date:{" "}
                      {new Date(response.createdAt).toLocaleString("fr-FR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography align="center">No responses found.</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResponsesDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

ReclamationManagement.getLayout = function getLayout(page: ReactElement) {
  return (
    <PublicLayout>
      <RoleProtectedRoute allowedRoles={["USER"]}>{page}</RoleProtectedRoute>
    </PublicLayout>
  );
};

export default ReclamationManagement;
