import React, { useState, useEffect, ReactElement } from "react";
import { useRouter } from "next/router";
import { useTheme, styled } from "@mui/material/styles";
import {
  Box,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Grid,
  useMediaQuery,
  Checkbox,
  CircularProgress,
  TableSortLabel,
  Drawer,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import DashboardLayout from "src/layouts/Dashboard";
import AddCommentIcon from "@mui/icons-material/AddComment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useGetReclamationsQuery, useUpdateReclamationMutation } from "src/api/reclamationApi";
import {
  useGetResponsesByClaimsIdQuery,
  useCreateResponseMutation,
} from "src/api/reponseApi";
import { FormProvider, useForm } from "react-hook-form";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import RHFTextField from "src/components/hook-form/RHTextField";
import { Reclamation, ResponseEntity, ReclamationStatus } from "src/types/shared";
import { EnhancedTableHeadProps } from "src/types/table";

// Form data interface
interface ResponseFormData {
  content: string;
}

// Styled components
const PageContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  minHeight: "calc(100vh - 64px)",
  padding: theme.spacing(2),
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(3),
  },
}));

const MainContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  boxShadow: theme.shadows[1],
  marginTop: theme.spacing(2),
  flex: 1,
  display: "flex",
  flexDirection: "column",
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(3),
  },
}));

const TableWrapper = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  [theme.breakpoints.up("sm")]: {
    marginTop: theme.spacing(3),
  },
}));

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  "& .MuiTable-root": {
    minWidth: 650,
    [theme.breakpoints.down("sm")]: {
      minWidth: "100%",
    },
  },
  "& .MuiTableCell-head:last-child": {
    textAlign: "center",
    paddingRight: theme.spacing(3),
  },
  "& .MuiTableRow-root": {
    backgroundColor: theme.palette.background.paper,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  "& .MuiTableCell-root": {
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
    [theme.breakpoints.up("sm")]: {
      padding: theme.spacing(1.5),
    },
    [theme.breakpoints.up("md")]: {
      padding: theme.spacing(2),
    },
  },
}));

const ResponsiveTableCell = styled(TableCell)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    "&:nth-of-type(1)": { width: "10%" },
    "&:nth-of-type(2)": { width: "20%" },
    "&:nth-of-type(3)": { width: "25%" },
    "&:nth-of-type(4)": { width: "20%" },
    "&:nth-of-type(5)": { width: "15%" },
    "&:nth-of-type(6)": { width: "10%" },
  },
}));

const SubmitButton = styled(LoadingButton)(({ theme }) => ({
  border: "1px solid",
  borderColor: "#054547",
  background: "#fff",
  color: "#054547",
  width: "100%",
  height: "50px",
  lineHeight: "50px",
  cursor: "pointer",
  borderRadius: 0,
  margin: 0,
  "&:hover": {
    background: "#054547",
    color: "#fff",
  },
  [theme.breakpoints.up("sm")]: {
    width: "calc(50% - 5px)",
    marginLeft: "10px",
  },
}));

const ActionButton = styled(LoadingButton)(({ theme }) => ({
  border: "1px solid",
  borderColor: "#054547",
  background: "#fff",
  color: "#054547",
  width: "100%",
  height: "50px",
  lineHeight: "50px",
  cursor: "pointer",
  borderRadius: 0,
  margin: 0,
  "&:hover": {
    background: "#054547",
    color: "#fff",
  },
  [theme.breakpoints.up("sm")]: {
    width: "calc(50% - 5px)",
  },
}));

// Table head cells
const headCells = [
  {
    id: "memberFullName",
    numeric: false,
    disablePadding: false,
    label: "Member",
    alwaysVisible: false,
  },
  {
    id: "title",
    numeric: false,
    disablePadding: false,
    label: "Title",
    alwaysVisible: false,
  },
  {
    id: "description",
    numeric: false,
    disablePadding: false,
    label: "Description",
    alwaysVisible: false,
  },
  {
    id: "status",
    numeric: false,
    disablePadding: false,
    label: "Status",
    alwaysVisible: true,
  },
  {
    id: "createdAt",
    numeric: false,
    disablePadding: false,
    label: "Date",
    alwaysVisible: true,
  },
  {
    id: "actions",
    numeric: false,
    disablePadding: false,
    label: "Actions",
    alwaysVisible: false,
  },
];

// Enhanced table head component
const EnhancedTableHead: React.FC<EnhancedTableHeadProps> = ({
  onSelectAllClick,
  order,
  orderBy,
  numSelected,
  rowCount,
  onRequestSort,
  headCells,
  isMobile,
}) => {
  const createSortHandler =
    (property: string) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  return (
    <TableHead>
      <TableRow>
        <ResponsiveTableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            inputProps={{ "aria-label": "select all reclamations" }}
          />
        </ResponsiveTableCell>
        {headCells.map((headCell) => (
          <ResponsiveTableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sx={{ display: isMobile ? "none" : "table-cell" }}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={{ display: "none" }}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </ResponsiveTableCell>
        ))}
      </TableRow>
    </TableHead>
  );
};

const ResponseManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();

  // State for drawer, dialog, selection, and pagination
  const [showDrawer, setShowDrawer] = useState(false);
  const [showResponsesDialog, setShowResponsesDialog] = useState(false);
  const [selectedReclamationId, setSelectedReclamationId] = useState<
    string | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [orderBy, setOrderBy] = useState<string>("createdAt");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch admin ID from sessionStorage
  const adminId = sessionStorage.getItem("userID") || "";

  // API hooks
  const {
    data: reclamationsData,
    isLoading: isReclamationsLoading,
    isError: isReclamationsError,
  } = useGetReclamationsQuery({
    page: page + 1,
    perPage: rowsPerPage,
  });

  const {
    data: responsesData,
    isLoading: isResponsesLoading,
    isError: isResponsesError,
  } = useGetResponsesByClaimsIdQuery(selectedReclamationId || "", {
    skip: !selectedReclamationId,
  });

  const [
    createResponse,
    { isLoading: isCreating, isSuccess: isCreateSuccess, error: createError },
  ] = useCreateResponseMutation();

  const [
    updateReclamation,
    { isLoading: isUpdating, isSuccess: isUpdateSuccess, error: updateError },
  ] = useUpdateReclamationMutation();

  // Form setup
  const responseMethods = useForm<ResponseFormData>({
    defaultValues: {
      content: "",
    },
  });

  // Handle selection
  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && reclamationsData?.data) {
      const newSelected = reclamationsData.data.map(
        (reclamation) => reclamation.id
      );
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  // Handle sorting
  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: string
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
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

  // Handle drawer
  const handleOpenDrawer = (reclamationId: string) => {
    if (!adminId) {
      setErrorMessage("Admin ID is missing. Please log in again.");
      router.push("/admin/login");
      return;
    }
    setSelectedReclamationId(reclamationId);
    setShowDrawer(true);
    responseMethods.reset();
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setSelectedReclamationId(null);
    responseMethods.reset();
    setErrorMessage("");
    setSuccessMessage("");
  };

  // Handle responses dialog
  const handleOpenResponsesDialog = (reclamationId: string) => {
    setSelectedReclamationId(reclamationId);
    setShowResponsesDialog(true);
  };

  const handleCloseResponsesDialog = () => {
    setShowResponsesDialog(false);
    setSelectedReclamationId(null);
  };

  // Handle create response
  const handleCreateResponse = async () => {
    if (!selectedReclamationId) {
      setErrorMessage("Reclamation ID is missing.");
      console.error("Missing selectedReclamationId:", selectedReclamationId);
      return;
    }

    const isValid = await responseMethods.trigger();
    if (!isValid) {
      setErrorMessage("Please provide a valid response content.");
      return;
    }

    const formData = responseMethods.getValues();
    try {
      console.log("Creating response with data:", {
        content: formData.content,
        reclamationId: selectedReclamationId,
      });
      await createResponse({
        content: formData.content,
        reclamationId: selectedReclamationId,
      }).unwrap();

      // Update reclamation status to RESOLVED
      await updateReclamation({
        id: selectedReclamationId,
        data: {
          status: ReclamationStatus.RESOLVED,
        },
      }).unwrap();

      setSuccessMessage("Response created and reclamation resolved successfully!");
      setTimeout(() => {
        handleCloseDrawer();
      }, 2000);
    } catch (err: any) {
      console.error("Error creating response or updating reclamation:", err);
      setErrorMessage(err.data?.message || "Failed to create response or update reclamation.");
    }
  };

  // Effect for success messages
  useEffect(() => {
    if (isCreateSuccess || isUpdateSuccess) {
      setTimeout(() => {
        setSuccessMessage("");
      }, 2000);
    }
  }, [isCreateSuccess, isUpdateSuccess]);

  
  useEffect(() => {
    if (!adminId) {
      setErrorMessage("Admin ID is missing. Please log in again.");
      router.push("/admin/login");
    }
  }, [adminId, router]);

  // Loading and error states
  if (isReclamationsLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }
  if (isReclamationsError) {
    return <Alert severity="error">Error loading reclamations</Alert>;
  }

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Response Management
      </Typography>

      <MainContainer>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid
            item
            xs={12}
            sm={8}
            md={9}
            sx={{ display: "flex", justifyContent: "flex-end" }}
          >
            {/* Placeholder for BulkActions if needed */}
          </Grid>
        </Grid>

        <TableWrapper>
          <StyledTableContainer>
            <Table stickyHeader aria-label="reclamations table">
              <EnhancedTableHead
                numSelected={selected.length}
                order={order}
                orderBy={orderBy}
                onSelectAllClick={handleSelectAllClick}
                onRequestSort={handleRequestSort}
                rowCount={reclamationsData?.data.length || 0}
                headCells={headCells}
                isMobile={isMobile}
              />
              <TableBody>
                {reclamationsData?.data.length ? (
                  reclamationsData.data.map((reclamation) => {
                    const isItemSelected = isSelected(reclamation.id);
                    return (
                      <TableRow
                        key={reclamation.id}
                        hover
                        onClick={(event) => handleClick(event, reclamation.id)}
                        role="checkbox"
                        aria-checked={isItemSelected}
                        tabIndex={-1}
                        selected={isItemSelected}
                      >
                        <ResponsiveTableCell padding="checkbox">
                          <Checkbox
                            color="primary"
                            checked={isItemSelected}
                            inputProps={{ "aria-labelledby": reclamation.id }}
                          />
                        </ResponsiveTableCell>
                        <ResponsiveTableCell>
                          {reclamation.memberFullName}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell>
                          {reclamation.title}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell
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
                        </ResponsiveTableCell>
                        <ResponsiveTableCell
                          sx={{ display: isMobile ? "none" : "table-cell" }}
                        >
                          <Typography
                            sx={{
                              color:
                                reclamation.status === ReclamationStatus.PENDING
                                  ? "#f28c38" 
                                  : "#4caf50", 
                              fontWeight: "medium",
                            }}
                          >
                            {reclamation.status}
                          </Typography>
                        </ResponsiveTableCell>
                        <ResponsiveTableCell
                          sx={{ display: isMobile ? "none" : "table-cell" }}
                        >
                          {new Date(reclamation.createdAt).toLocaleString(
                            "fr-FR",
                            {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell align="center">
                          <Box display="flex" justifyContent="center" gap={1}>
                            {reclamation.status === ReclamationStatus.PENDING ? (
                              <Tooltip title="Add Response">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDrawer(reclamation.id);
                                  }}
                                  size="small"
                                  color="primary"
                                >
                                  <AddCommentIcon
                                    fontSize={isMobile ? "small" : "medium"}
                                  />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="View Response">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenResponsesDialog(reclamation.id);
                                  }}
                                  size="small"
                                  color="primary"
                                >
                                  <VisibilityIcon
                                    fontSize={isMobile ? "small" : "medium"}
                                  />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </ResponsiveTableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <ResponsiveTableCell colSpan={6} align="center">
                      No reclamations found.
                    </ResponsiveTableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={reclamationsData?.total || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableWrapper>
      </MainContainer>

      {/* Create Response Drawer */}
      <Drawer
        anchor="right"
        open={showDrawer}
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: {
            width: isMobile ? "100%" : "450px",
            padding: isMobile ? theme.spacing(2) : theme.spacing(3),
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          },
        }}
      >
        <Typography variant="h6" sx={{ mb: 3 }}>
          Manage Response
        </Typography>

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <FormProvider {...responseMethods}>
          <RHFTextField
            name="content"
            label="Response Content"
            multiline
            rows={4}
            required
            fullWidth
            error={!!responseMethods.formState.errors.content}
            helperText={responseMethods.formState.errors.content?.message}
          />
        </FormProvider>

        <Box
          sx={{
            display: "flex",
            gap: "10px",
            mt: "auto",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <ActionButton onClick={handleCloseDrawer}>Cancel</ActionButton>
          <SubmitButton
            onClick={handleCreateResponse}
            disabled={isCreating || isUpdating}
            loading={isCreating || isUpdating}
          >
            Confirm
          </SubmitButton>
        </Box>
      </Drawer>

      {/* Responses Dialog */}
      <Dialog
        open={showResponsesDialog}
        onClose={handleCloseResponsesDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Response for Reclamation</DialogTitle>
        <DialogContent>
          {isResponsesLoading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : isResponsesError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error loading response
            </Alert>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {responsesData?.length ? (
                <Paper
                  sx={{
                    p: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body1">
                    <strong>Content:</strong> {responsesData[0].content}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Response Date:</strong>{" "}
                    {new Date(responsesData[0].createdAt).toLocaleString("fr-FR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Paper>
              ) : (
                <Typography align="center">No response found.</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResponsesDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

ResponseManagement.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default ResponseManagement;