import React, { useState, ChangeEvent, ReactElement } from "react";
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} from "src/api/expenseApi";
import { Expenses, ExpenseType } from "src/types/shared";
import {
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Select,
  TextField,
  FormHelperText,
  FormControl,
  Drawer,
  styled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
  Box,
  Grid,
  useTheme,
  useMediaQuery,
  Theme,
  Checkbox,
  CircularProgress,
  Alert,
  TableSortLabel,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import DashboardLayout from "../../layouts/Dashboard";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BulkActions from "src/components/Table/members/TableHeader";
import { EnhancedTableHeadProps, HeadCell } from "src/types/table";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";

// Styles personnalisés (reprise de votre style existant)
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
    paddingRight: theme.spacing(3)
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
    "&:nth-of-type(1)": { width: "30%" },
    "&:nth-of-type(2)": { width: "20%" },
    "&:nth-of-type(3)": { width: "25%" },
    "&:nth-of-type(4)": { width: "15%" },
    "&:nth-of-type(5)": { width: "10%" },
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

const ActionButton = styled(Button)(({ theme }) => ({
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

const ExpenseComponent = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  const { data: expenses, isLoading, isError, refetch } = useGetExpensesQuery();
  const [createExpense] = useCreateExpenseMutation();
  const [updateExpense] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();

    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<ExpenseType | "all">("all");
    const [newExpense, setNewExpense] = useState<Omit<Expenses, 'id' | 'createdAt' | 'updatedAt'>>({
        name: "",
        description: "",
        amount: 0,
        type: ExpenseType.MENSUEL,
       
    });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Expenses | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [orderBy, setOrderBy] = useState<string>("name");

    const headCells = [
        {
            id: "name",
            numeric: false,
            disablePadding: false,
            label: "Name",
            alwaysVisible: false,
        },
        {
            id: "amount",
            numeric: false,
            disablePadding: false,
            label: "Amount",
            alwaysVisible: false,
        },
        {
            id: "type",
            numeric: false,
            disablePadding: false,
            label: "Type",
            alwaysVisible: !isMobile,
        },
        
        {
            id: "actions",
            numeric: false,
            disablePadding: false,
            label: "Actions",
            alwaysVisible: false,
        },
    ];

    // Gestion de la sélection et tri (identique à PriceComponent)
    const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleClick = (event: React.MouseEvent<unknown>, id: string) => { /* ... */ };
    const handleRequestSort = (event: React.MouseEvent<unknown>, property: string) => { /* ... */ };
    const isSelected = (id: string) => selected.indexOf(id) !== -1;

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const currentAmount = editExpense?.amount ?? newExpense.amount;

    // Validation du nom
    if (!(editExpense ? editExpense.name : newExpense.name).trim()) {
      errors.name = "Le nom est obligatoire";
    }

    // Validation du montant
    if (isNaN(currentAmount)) {
      errors.amount = "Le montant doit être un nombre";
    } else if (currentAmount <= 0) {
      errors.amount = "Le montant doit être supérieur à 0";
    }

    // Validation du type
    if (!(editExpense ? editExpense.type : newExpense.type)) {
      errors.type = "Le type est obligatoire";
    }

        setErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleAddExpense = async () => {
        setErrors({});
        if (validateForm()) {
            try {
                const response = await createExpense(newExpense).unwrap();
                console.log('Success:', response);
                setShowDrawer(false);
                setNewExpense({
                    name: "",
                    description: "",
                    amount: 0,
                    type: ExpenseType.MENSUEL,
                    
                });
            } catch (error: any) {
                console.error("Error details:", error);
                if (error.data) {
                    setErrors(error.data.errors);
                }
            }
        }
    };

  const handleUpdateExpense = async () => {
    setErrors({});
    if (editExpense && validateForm()) {
      try {
        const { id, createdAt, updatedAt, ...data } = editExpense;
        await updateExpense({ id, data }).unwrap();
        setEditExpense(null);
        setShowDrawer(false);
        setSelected([]);
      } catch (error) {
        console.error("Error updating expense:", error);
      }
    }
  };

  const confirmDeleteExpense = (id: string) => {
    setExpenseToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (expenseToDelete) {
      await deleteExpense(expenseToDelete);
      setShowDeleteModal(false);
      setExpenseToDelete(null);
      setSelected(selected.filter((id) => id !== expenseToDelete));
    }
  };

    const filteredExpenses = expenses?.filter((expense) => {
        const matchesSearch = expense.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "all" || expense.type === typeFilter;
        return matchesSearch && matchesType;
    });

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) =>
    setSearchTerm(e.target.value);

  if (isLoading)
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  if (isError) return <Alert severity="error">Error loading expenses</Alert>;

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Expense Management
      </Typography>

      <MainContainer>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4} md={3}>
            <FormControl sx={{ width: "200px", height: "40px" }}>
              <Select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as ExpenseType | "all")
                }
                displayEmpty
                sx={{ height: "40px", fontSize: "14px" }}
              >
                <MenuItem value="all">All types</MenuItem>
                <MenuItem value={ExpenseType.MENSUEL}>Monthly</MenuItem>
                <MenuItem value={ExpenseType.JOURNALIER}>Daily</MenuItem>
              </Select>
            </FormControl>
          </Grid>

                    <Grid item xs={12} sm={8} md={9} sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <BulkActions
                            handleClickOpen={() => {
                                setNewExpense({
                                    name: "",
                                    description: "",
                                    amount: 0,
                                    type: ExpenseType.MENSUEL,
                                   
                                });
                                setShowDrawer(true);
                            }}
                            onHandleSearch={handleSearch}
                            search={searchTerm}
                            refetch={refetch}
                            isMobile={isMobile}
                        />
                    </Grid>
                </Grid>

                <TableWrapper>
                    <StyledTableContainer>
                        <Table stickyHeader aria-label="expenses table">
                            <EnhancedTableHead
                                numSelected={selected.length}
                                order={order}
                                orderBy={orderBy}
                                onSelectAllClick={handleSelectAllClick}
                                onRequestSort={handleRequestSort}
                                rowCount={filteredExpenses?.length || 0}
                                headCells={headCells}
                                isMobile={isMobile}
                            />
                            <TableBody>
                                {filteredExpenses?.map((expenses) => (
                                    <TableRow
                                        key={expenses.id}
                                        hover
                                        onClick={(event) => handleClick(event, expenses.id)}
                                        selected={isSelected(expenses.id)}
                                    >
                                        <ResponsiveTableCell padding="checkbox">
                                            <Checkbox
                                                color="primary"
                                                checked={isSelected(expenses.id)}
                                                inputProps={{ "aria-labelledby": expenses.id }}
                                            />
                                        </ResponsiveTableCell>
                                        <ResponsiveTableCell>{expenses.name}</ResponsiveTableCell>
                                        <ResponsiveTableCell>
                                            {expenses.amount ? `${parseFloat(expenses.amount.toString())} DT` : "0 DT"}
                                        </ResponsiveTableCell>
                                        {!isMobile && (
                                            <>
                                                <ResponsiveTableCell>
                                                    {expenses.type === ExpenseType.MENSUEL ? "Monthly" : "Daily"}
                                                </ResponsiveTableCell>
                                                
                                            </>
                                        )}
                                        <ResponsiveTableCell align="center">
                                            <Box display="flex" justifyContent="center" gap={1}>
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditExpense(expenses);
                                                        setShowDrawer(true);
                                                    }}
                                                    size="small"
                                                    color="primary"
                                                >
                                                    <EditIcon fontSize={isMobile ? "small" : "medium"} />
                                                </IconButton>
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        confirmDeleteExpense(expenses.id);
                                                    }}
                                                    size="small"
                                                    color="error"
                                                >
                                                    <DeleteIcon fontSize={isMobile ? "small" : "medium"} />
                                                </IconButton>
                                            </Box>
                                        </ResponsiveTableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </StyledTableContainer>
                </TableWrapper>
            </MainContainer>

      <Dialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        fullScreen={isMobile}
      >
        <DialogTitle>Delete Expense</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this expense? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

            <Drawer
                anchor="right"
                open={showDrawer}
                onClose={() => {
                    setShowDrawer(false);
                    setEditExpense(null);
                    setErrors({});
                }}
                PaperProps={{
                    sx: {
                        width: isMobile ? "100%" : "450px",
                        padding: isMobile ? theme.spacing(2) : theme.spacing(3),
                        gap: "20px",
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 3 }}>
                    {editExpense ? "Edit Expense" : "New Expense"}
                </Typography>

                <TextField
                    label="Name"
                    fullWidth
                    value={editExpense?.name || newExpense.name}
                    onChange={(e) =>
                        editExpense
                            ? setEditExpense({ ...editExpense, name: e.target.value })
                            : setNewExpense({ ...newExpense, name: e.target.value })
                    }
                    error={!!errors?.name} // <-- Ajout du ?. ici
                    helperText={errors?.name || ''} // <-- Et ici
                />

        <TextField
          label="Description"
          fullWidth
          multiline
          rows={3}
          value={editExpense?.description || newExpense.description}
          onChange={(e) =>
            editExpense
              ? setEditExpense({ ...editExpense, description: e.target.value })
              : setNewExpense({ ...newExpense, description: e.target.value })
          }
        />

        <TextField
          label="Montant (DT)"
          fullWidth
          type="number"
          inputProps={{
            min: "0.01",
            step: "0.01",
            pattern: "^\\d+(\\.\\d{1,2})?$",
          }}
          value={editExpense?.amount ?? newExpense.amount}
          onChange={(e) => {
            const value = parseFloat(e.target.value);

            if (!isNaN(value)) {
              editExpense
                ? setEditExpense({ ...editExpense, amount: value })
                : setNewExpense({ ...newExpense, amount: value });
            }
          }}
          error={!!errors?.amount}
          helperText={errors?.amount || ""}
        />

        <FormControl fullWidth error={!!errors?.type}>
          <Select
            value={editExpense?.type || newExpense.type}
            onChange={(e) =>
              editExpense
                ? setEditExpense({
                    ...editExpense,
                    type: e.target.value as ExpenseType,
                  })
                : setNewExpense({
                    ...newExpense,
                    type: e.target.value as ExpenseType,
                  })
            }
            label="Type"
          >
            <MenuItem value={ExpenseType.MENSUEL}>Monthly</MenuItem>
            <MenuItem value={ExpenseType.JOURNALIER}>Daily</MenuItem>
          </Select>
          {errors?.type && <FormHelperText>{errors?.type}</FormHelperText>}
        </FormControl>

                

                <Box sx={{ display: "flex", gap: "10px", mt: "auto", flexDirection: isMobile ? "column" : "row" }}>
                    <ActionButton onClick={() => setShowDrawer(false)}>Cancel</ActionButton>
                    <SubmitButton onClick={editExpense ? handleUpdateExpense : handleAddExpense}>
                        {editExpense ? "Update" : "Create"}
                    </SubmitButton>
                </Box>
            </Drawer>
        </PageContainer>
    );
};

ExpenseComponent.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default ExpenseComponent;
