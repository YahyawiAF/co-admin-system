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
  Divider,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Power } from "react-feather";
import { CiEdit } from "react-icons/ci";
import { MdOutlineDeleteOutline, MdAddAlert } from "react-icons/md";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice";
import { useLogoutMutation } from "src/api/auth.repo";
import useAuth from "src/hooks/useAuth";
import { FormProvider, useForm } from "react-hook-form";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import PublicLayout from "src/layouts/PublicLayout";
import {
  useGetReclamationsQuery,
  useCreateReclamationMutation,
  useUpdateReclamationMutation,
  useDeleteReclamationMutation,
} from "src/api/reclamationApi";
import RHFTextField from "src/components/hook-form/RHTextField";
import { Reclamation } from "src/types/shared";

// Form data interface for react-hook-form
interface ReclamationFormData {
  title: string;
  description: string;
  memberId: string;
}

// Styled components remain unchanged
const ReclamationCard = styled(Box)(({ theme }) => ({
  position: "relative",
  transition: "all 0.3s ease",
  borderRadius: 12,
  background: theme.palette.background.paper,
  border: `2px solid ${theme.palette.primary.main}`,
  boxShadow: theme.shadows[2],
  width: "100%",
  margin: "0 auto",
  overflow: "hidden",
  "&:hover": {
    transform: "translateY(-8px)",
    boxShadow: theme.shadows[6],
    borderColor: theme.palette.primary.light,
  },
}));

const HeaderBox = styled(Box)(({ theme }) => ({
  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(2),
  textAlign: "center",
}));

const NavigationContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
}));

const ReclamationManagement = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();

  // State for pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // State for modals and stepper
  const [activeStep, setActiveStep] = useState(0);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const steps = ["Enter Details", "Confirm"];

  // Fetch memberId from sessionStorage
  const memberId = sessionStorage.getItem("member") || "";

  // API hooks
  const {
    data: reclamationsData,
    isLoading,
    isError,
  } = useGetReclamationsQuery({
    page: page + 1,
    perPage: rowsPerPage,
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
      memberId: memberId, // Use memberId from sessionStorage
    },
  });

  // Form setup for edit reclamation
  const editMethods = useForm<ReclamationFormData>({
    defaultValues: {
      title: "",
      description: "",
      memberId: memberId, // Initialize with sessionStorage memberId as fallback
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

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    setActiveStep(0);
    createMethods.reset();
  };

  // State for selected reclamation ID (for editing and deleting)
  const [selectedReclamationId, setSelectedReclamationId] = useState<
    string | null
  >(null);

  // Handle edit dialog
  const handleOpenEditDialog = (reclamation: Reclamation) => {
    editMethods.reset({
      title: reclamation.title,
      description: reclamation.description,
      memberId: reclamation.memberId || memberId, // Use reclamation's memberId, fallback to sessionStorage
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
        await createReclamation(formData).unwrap();
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
        data: formData,
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

  if (isLoading)
    return <CircularProgress sx={{ display: "block", mx: "auto", my: 4 }} />;
  if (isError)
    return (
      <Alert severity="error" sx={{ m: 4 }}>
        Error loading reclamations
      </Alert>
    );

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
          <Tooltip title="Sign out">
            <IconButton
              onClick={handleSignOut}
              color="inherit"
              edge="end"
              sx={{
                "&:hover": { backgroundColor: theme.palette.action.hover },
              }}
            >
              <Power fontSize="medium" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 3, md: 6 }, px: { xs: 2, sm: 4 } }}
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

          {/* Reclamations Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reclamationsData?.data.map((reclamation) => (
                  <TableRow key={reclamation.id}>
                    <TableCell>{reclamation.memberFullName}</TableCell>
                    <TableCell>{reclamation.title}</TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 300,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {reclamation.description.length > 100
                        ? `${reclamation.description.substring(0, 100)}...`
                        : reclamation.description}
                    </TableCell>
                    <TableCell>
                      {new Date(reclamation.createdAt).toLocaleString("fr-FR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton
                          onClick={() => handleOpenEditDialog(reclamation)}
                        >
                          <CiEdit size={24} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => handleOpenDeleteDialog(reclamation.id)}
                        >
                          <MdOutlineDeleteOutline size={24} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
                {/* Optionally, you can hide memberId field since it's not user-editable */}
                <input
                  type="hidden"
                  {...createMethods.register("memberId")}
                  value={memberId}
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
                <Typography>
                  <strong>Member ID:</strong>{" "}
                  {createMethods.getValues("memberId")}
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
              {/* Optionally, you can hide memberId field since it's not user-editable */}
              <input type="hidden" {...editMethods.register("memberId")} />
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
