import React, { useState, useEffect, ChangeEvent, ReactElement } from "react";
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
  TextField,
  FormHelperText,
  // Removed TablePagination
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import DashboardLayout from "src/layouts/Dashboard";
import AddCommentIcon from "@mui/icons-material/AddComment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useGetReclamationsQuery } from "src/api/reclamationApi";
import {
  useGetPaginatedResponsesQuery,
  useCreateResponseMutation,
} from "src/api/reponseApi";
import { FormProvider, useForm } from "react-hook-form";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import RHFTextField from "src/components/hook-form/RHTextField";
import { Reclamation, ReclamationStatus } from "src/types/shared";
import useAuth from "src/hooks/useAuth";
import { EnhancedTableHeadProps } from "src/types/table";

// Form data interface
interface ResponseFormData {
  content: string;
}

// Styled components (aligned with PriceComponent)
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
    label: "Created At",
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
            sortDirection={orderBy === headCell.id ? order : false}
            sx={{ display: isMobile && !headCell ? "none" : "table-cell" }} // Fixed typo: added .alwaysVisible
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
  const { user } = useAuth();

  // State for drawer and selection
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedReclamationId, setSelectedReclamationId] = useState<
    string | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [orderBy, setOrderBy] = useState<string>("createdAt");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // API hooks
  const {
    data: reclamationsData,
    isLoading: isReclamationsLoading,
    isError: isReclamationsError,
  } = useGetReclamationsQuery({}); // Removed page and perPage

  const {
    data: responsesData,
    isLoading: isResponsesLoading,
    isError: isResponsesError,
  } = useGetPaginatedResponsesQuery({
    reclamationId: selectedReclamationId || undefined,
  }); // Removed page and perPage

  const [
    createResponse,
    { isLoading: isCreating, isSuccess: isCreateSuccess, error: createError },
  ] = useCreateResponseMutation();

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

  // Handle drawer
  const handleOpenDrawer = (reclamationId: string) => {
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

  // Handle create response
  const handleCreateResponse = async () => {
    if (!selectedReclamationId || !user?.id) {
      setErrorMessage("User or reclamation ID is missing.");
      console.error("Missing user.id or selectedReclamationId:", {
        userId: user?.id,
        reclamationId: selectedReclamationId,
      });
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
        adminId: user.id,
      });
      await createResponse({
        content: formData.content,
        reclamationId: selectedReclamationId,
        adminId: user.id,
      }).unwrap();
      setSuccessMessage("Response created successfully!");
      setTimeout(() => {
        handleCloseDrawer();
      }, 2000);
    } catch (err: any) {
      console.error("Error creating response:", err);
      setErrorMessage(err.data?.message || "Failed to create response.");
    }
  };

  // Effect for success messages
  useEffect(() => {
    if (isCreateSuccess) {
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }
  }, [isCreateSuccess]);

  // Loading and error states
  if (isReclamationsLoading)
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  if (isReclamationsError)
    return <Alert severity="error">Error loading reclamations</Alert>;

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
                {reclamationsData?.data.map((reclamation) => {
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
                        {reclamation.status}
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
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReclamationId(reclamation.id);
                            }}
                            size="small"
                            color="primary"
                          >
                            <VisibilityIcon
                              fontSize={isMobile ? "small" : "medium"}
                            />
                          </IconButton>
                        </Box>
                      </ResponsiveTableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </TableWrapper>

        {/* Responses Table */}
        {selectedReclamationId && (
          <>
            <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
              Responses for Reclamation
            </Typography>
            {isResponsesLoading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress />
              </Box>
            ) : isResponsesError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                Error loading responses
              </Alert>
            ) : (
              <StyledTableContainer>
                <Table stickyHeader aria-label="responses table">
                  <TableHead>
                    <TableRow>
                      <ResponsiveTableCell>Content</ResponsiveTableCell>
                      <ResponsiveTableCell>Admin</ResponsiveTableCell>
                      <ResponsiveTableCell>Created At</ResponsiveTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {responsesData?.data.map((response) => (
                      <TableRow key={response.id}>
                        <ResponsiveTableCell>
                          {response.content}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell>
                          {response.adminFullName}
                        </ResponsiveTableCell>
                        <ResponsiveTableCell>
                          {new Date(response.createdAt).toLocaleString(
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </StyledTableContainer>
            )}
          </>
        )}
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
          Create Response
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
            disabled={isCreating}
            loading={isCreating}
          >
            Submit
          </SubmitButton>
        </Box>
      </Drawer>
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
