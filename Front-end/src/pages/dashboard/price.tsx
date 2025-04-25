import React, { useState, ChangeEvent, ReactElement } from "react";
import {
  useGetPricesQuery,
  useCreatePriceMutation,
  useUpdatePriceMutation,
  useDeletePriceMutation,
} from "src/api/price.repo";
import { Price, PriceType, TimeInterval } from "src/types/shared";
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

// Styles personnalisés
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
            inputProps={{ "aria-label": "select all prices" }}
          />
        </ResponsiveTableCell>
        {headCells.map((headCell) => (
          <ResponsiveTableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
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

const PriceComponent = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  const { data: prices, isLoading, isError, refetch } = useGetPricesQuery();
  const [createPrice] = useCreatePriceMutation();
  const [updatePrice] = useUpdatePriceMutation();
  const [deletePrice] = useDeletePriceMutation();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<PriceType | "all">("all");
  const [newPrice, setNewPrice] = useState<Price>({
    id: "",
    name: "",
    price: 0,
    timePeriod: { start: "", end: "" },
    createdAt: null,
    updatedAt: null,
    type: PriceType.journal,
    journals: [],
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<Price | null>(null);
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
      id: "price",
      numeric: false,
      disablePadding: false,
      label: "Price",
      alwaysVisible: false,
    },
    {
      id: "timePeriod",
      numeric: false,
      disablePadding: false,
      label: "Time Period",
      alwaysVisible: !isMobile,
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

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && filteredPrices) {
      const newSelected = filteredPrices.map((price) => price.id);
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

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: string
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!(editPrice ? editPrice.name : newPrice.name))
      errors.name = "Name is required";
    if ((editPrice ? editPrice.price : newPrice.price) <= 0)
      errors.price = "Price must be greater than 0";
    if (!(editPrice ? editPrice.timePeriod.start : newPrice.timePeriod.start))
      errors.timePeriodStart = "Start time is required";
    if (!(editPrice ? editPrice.timePeriod.end : newPrice.timePeriod.end))
      errors.timePeriodEnd = "End time is required";
    if (!(editPrice ? editPrice.type : newPrice.type))
      errors.type = "Type is required";

    setErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleAddPrice = async () => {
    setErrors({});
    if (validateForm()) {
      try {
        await createPrice(newPrice).unwrap();
        setShowDrawer(false);
        setNewPrice({
          id: "",
          name: "",
          price: 0,
          timePeriod: { start: "", end: "" },
          createdAt: null,
          updatedAt: null,
          type: PriceType.journal,
          journals: [],
        });
        setSelected([]);
      } catch (error) {
        console.error("Error adding price:", error);
      }
    }
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditPrice(null);
    setErrors({});
  };

  const handleUpdatePrice = async () => {
    setErrors({});
    if (editPrice && validateForm()) {
      try {
        const { id, createdAt, updatedAt, ...data } = editPrice;
        await updatePrice({ id, data }).unwrap();
        setEditPrice(null);
        setShowDrawer(false);
        setSelected([]);
      } catch (error) {
        console.error("Error updating price:", error);
      }
    }
  };

  const confirmDeletePrice = (id: string) => {
    setPriceToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (priceToDelete) {
      await deletePrice(priceToDelete);
      setShowDeleteModal(false);
      setPriceToDelete(null);
      setSelected(selected.filter((id) => id !== priceToDelete));
    }
  };

  const formatTimeInterval = (interval: TimeInterval) => {
    return `${interval.start} - ${interval.end}`;
  };

  const filteredPrices = prices?.filter((price) => {
    const matchesSearch = price.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || price.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (isLoading)
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  if (isError) return <Alert severity="error">Error loading prices</Alert>;

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Rate Management
      </Typography>

      <MainContainer>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          {/* Partie gauche - Select */}
          <Grid item xs={12} sm={4} md={3}>
            <FormControl
              sx={{
                width: "200px",
                height: "40px",
                "& .MuiOutlinedInput-root": {
                  height: "40px",
                },
              }}
            >
              <Select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as PriceType | "all")
                }
                displayEmpty
                sx={{
                  height: "40px",
                  fontSize: "14px",
                  "& .MuiSelect-select": {
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      marginTop: "8px",
                      maxHeight: "300px",
                    },
                  },
                }}
              >
                <MenuItem value="all" sx={{ fontSize: "14px" }}>
                  All types
                </MenuItem>
                <MenuItem value={PriceType.journal} sx={{ fontSize: "14px" }}>
                  Journal
                </MenuItem>
                <MenuItem
                  value={PriceType.abonnement}
                  sx={{ fontSize: "14px" }}
                >
                  Subscription
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Partie droite - BulkActions */}
          <Grid
            item
            xs={12}
            sm={8}
            md={9}
            sx={{ display: "flex", justifyContent: "flex-end" }}
          >
            <BulkActions
              handleClickOpen={() => {
                setNewPrice({
                  id: "",
                  name: "",
                  price: 0,
                  timePeriod: { start: "", end: "" },
                  createdAt: null,
                  updatedAt: null,
                  type: PriceType.journal,
                  journals: [],
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
            <Table stickyHeader aria-label="prices table">
              <EnhancedTableHead
                numSelected={selected.length}
                order={order}
                orderBy={orderBy}
                onSelectAllClick={handleSelectAllClick}
                onRequestSort={handleRequestSort}
                rowCount={filteredPrices?.length || 0}
                headCells={headCells}
                isMobile={isMobile}
              />
              <TableBody>
                {filteredPrices?.map((price) => {
                  const isItemSelected = isSelected(price.id);
                  return (
                    <TableRow
                      key={price.id}
                      hover
                      onClick={(event) => handleClick(event, price.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      selected={isItemSelected}
                    >
                      <ResponsiveTableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          inputProps={{ "aria-labelledby": price.id }}
                        />
                      </ResponsiveTableCell>
                      <ResponsiveTableCell>{price.name}</ResponsiveTableCell>
                      <ResponsiveTableCell>
                        {price.price} DT
                      </ResponsiveTableCell>
                      {!isMobile && (
                        <>
                          <ResponsiveTableCell>
                            {formatTimeInterval(price.timePeriod)}
                          </ResponsiveTableCell>
                          <ResponsiveTableCell>
                            {price.type === PriceType.journal
                              ? "Journal"
                              : "Subscription"}
                          </ResponsiveTableCell>
                        </>
                      )}
                      <ResponsiveTableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditPrice(price);
                              setShowDrawer(true);
                            }}
                            size="small"
                            color="primary"
                          >
                            <EditIcon
                              fontSize={isMobile ? "small" : "medium"}
                            />
                          </IconButton>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeletePrice(price.id);
                            }}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon
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
      </MainContainer>

      <Dialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        fullScreen={isMobile}
      >
        <DialogTitle>Delete Rate</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this rate? This action cannot be
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
          {editPrice ? "Manage Rate" : "New Rate"}
        </Typography>

        <TextField
          label="Name"
          fullWidth
          value={editPrice ? editPrice.name : newPrice.name}
          onChange={(e) =>
            editPrice
              ? setEditPrice({ ...editPrice, name: e.target.value })
              : setNewPrice({ ...newPrice, name: e.target.value })
          }
          error={!!errors.name}
          helperText={errors.name}
        />

        <TextField
          label="Price (DT)"
          fullWidth
          type="number"
          value={editPrice ? editPrice.price : newPrice.price}
          onChange={(e) => {
            const value = Math.max(0, +e.target.value);
            editPrice
              ? setEditPrice({ ...editPrice, price: value })
              : setNewPrice({ ...newPrice, price: value });
          }}
          error={!!errors.price}
          helperText={errors.price}
        />

        <TextField
          label="Start Time"
          fullWidth
          value={
            editPrice ? editPrice.timePeriod.start : newPrice.timePeriod.start
          }
          onChange={(e) =>
            editPrice
              ? setEditPrice({
                ...editPrice,
                timePeriod: {
                  ...editPrice.timePeriod,
                  start: e.target.value,
                },
              })
              : setNewPrice({
                ...newPrice,
                timePeriod: { ...newPrice.timePeriod, start: e.target.value },
              })
          }
          error={!!errors.timePeriodStart}
          helperText={errors.timePeriodStart}
        />

        <TextField
          label="End Time"
          fullWidth
          value={editPrice ? editPrice.timePeriod.end : newPrice.timePeriod.end}
          onChange={(e) =>
            editPrice
              ? setEditPrice({
                ...editPrice,
                timePeriod: { ...editPrice.timePeriod, end: e.target.value },
              })
              : setNewPrice({
                ...newPrice,
                timePeriod: { ...newPrice.timePeriod, end: e.target.value },
              })
          }
          error={!!errors.timePeriodEnd}
          helperText={errors.timePeriodEnd}
        />

        <FormControl fullWidth error={!!errors.type}>
          <Select
            value={editPrice ? editPrice.type : newPrice.type}
            onChange={(e) =>
              editPrice
                ? setEditPrice({
                  ...editPrice,
                  type: e.target.value as PriceType,
                })
                : setNewPrice({
                  ...newPrice,
                  type: e.target.value as PriceType,
                })
            }
            label="Type"
          >
            <MenuItem value={PriceType.journal}>Journal</MenuItem>
            <MenuItem value={PriceType.abonnement}>Subscription</MenuItem>
          </Select>
          {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
        </FormControl>

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
            onClick={editPrice ? handleUpdatePrice : handleAddPrice}
          >
            {editPrice ? "Update" : "Create"}
          </SubmitButton>
        </Box>
      </Drawer>
    </PageContainer>
  );
};
PriceComponent.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      {" "}
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default PriceComponent;
