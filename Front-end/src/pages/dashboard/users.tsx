import React, { useState, useCallback, useMemo } from "react";
import type { ChangeEvent, ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";

import {
  Checkbox,
  Grid,
  Divider as MuiDivider,
  Paper as MuiPaper,
  Table,
  TableBody,
  TableContainer,
  TableCell,
  TablePagination,
  TableRow,
  Typography,
  IconButton,
  Box,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
} from "@mui/material";
import { Edit, Delete, Add, PersonAdd } from "@mui/icons-material";

import { spacing } from "@mui/system";

import DashboardLayout from "../../layouts/Dashboard";
import { User, Role } from "../../types/shared";
import TableHeadAction from "../../components/Table/users/TableHeader";
import Drawer from "src/components/Drawer";
import SubPage from "src/components/SubPage";
import UserForm from "src/components/pages/dashboard/users/UserForm";

import { stableSort, getComparator } from "src/utils/table";
import { HeadCell } from "src/types/table";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import { useGetUsersQuery, useUpdateUserMutation } from "src/api/user.repo";
import { red, green, blue, orange, purple } from "@mui/material/colors";
import Modal from "src/components/Modal/BasicModal";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

const Divider = styled(MuiDivider)(spacing);
const Paper = styled(MuiPaper)(spacing);

const headCells: Array<HeadCell> = [
  {
    id: "fullname",
    numeric: false,
    disablePadding: true,
    label: "Full Name",
  },
  {
    id: "email",
    numeric: false,
    disablePadding: false,
    label: "Email",
  },
  {
    id: "role",
    numeric: false,
    disablePadding: false,
    label: "Role",
  },
  {
    id: "isActive",
    numeric: false,
    disablePadding: false,
    label: "Status",
  },
  {
    id: "createdAt",
    numeric: false,
    disablePadding: false,
    label: "Created At",
  },
  {
    id: "actions",
    numeric: false,
    disablePadding: false,
    label: "Actions",
  },
];

const getRoleColor = (role: Role) => {
  switch (role) {
    case Role.SUPER_ADMIN:
      return red[600];
    case Role.ADMIN:
      return purple[600];
    case Role.MANAGER:
      return blue[600];
    case Role.STAFF:
      return orange[600];
    case Role.MEMBER:
      return green[600];
    default:
      return "default";
  }
};

function EnhancedTable() {
  const [order, setOrder] = useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = useState<keyof User>("fullname");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [open, setOpen] = useState(false);
  const [openDeletModal, setOpenDeletModal] = useState(false);
  const [userSelected, setUserSelected] = useState<User | null>(null);
  const [editeUser, setEditeUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>(Role.MEMBER);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const { data: usersResponse, isLoading, refetch } = useGetUsersQuery();
  const users = usersResponse?.data || [];
  const [updateUser] = useUpdateUserMutation();
  
  console.log(users);
  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof User
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };


  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = users.map((n) => n.id);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: readonly string[] = [];

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

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditeUser(null);
  };

  const handleEdit = (user: User) => {
    setEditeUser(user);
    setOpen(true);
  };

  const handleDelete = (user: User) => {
    setUserSelected(user);
    setOpenDeletModal(true);
  };

  const handleRoleChange = (user: User) => {
    setUserSelected(user);
    setSelectedRole(user.role);
    setOpenRoleDialog(true);
  };

  const handleRoleUpdate = async () => {
    if (!userSelected) return;

    try {
      await updateUser({
        id: userSelected.id,
        data: { role: selectedRole },
      }).unwrap();

      setSnackbar({
        open: true,
        message: "User role updated successfully",
        severity: "success",
      });
      setOpenRoleDialog(false);
      refetch();
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to update user role",
        severity: "error",
      });
    }
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - users.length) : 0;


    console.log("users", users)
  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((user) => user.role === roleFilter);
  }, [users, roleFilter]);

  const sortedUsers = useMemo(
    () =>
      stableSort(filteredUsers, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [filteredUsers, order, orderBy, page, rowsPerPage]
  );

  const handleAction = () => {
    // Handle delete action
    setOpenDeletModal(false);
  };

  return (
    <RoleProtectedRoute allowedRoles={[Role.SUPER_ADMIN, Role.ADMIN]}>
      <Helmet title="Users Management" />
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Modal
            open={openDeletModal}
            handleClose={() => setOpenDeletModal(false)}
            handleAction={handleAction}
            title={"Delete User"}
            contentText={`Are you sure you want to remove ${userSelected?.fullname}`}
          />

          <Dialog
            open={openRoleDialog}
            onClose={() => setOpenRoleDialog(false)}
          >
            <DialogTitle>Change User Role</DialogTitle>
            <DialogContent>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={selectedRole}
                  label="Role"
                  onChange={(e) => setSelectedRole(e.target.value as Role)}
                >
                  {Object.values(Role).map((role) => (
                    <MenuItem key={role} value={role}>
                      {role.replace("_", " ")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenRoleDialog(false)}>Cancel</Button>
              <Button onClick={handleRoleUpdate} variant="contained">
                Update Role
              </Button>
            </DialogActions>
          </Dialog>

          <Drawer open={open} handleClose={handleClose}>
            <SubPage title="Manage User">
              <UserForm handleClose={handleClose} selectItem={editeUser} />
            </SubPage>
          </Drawer>

          <Paper>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                p: 2,
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <TableHeadAction
                search=""
                handleClickOpen={handleClickOpen}
                onHandleSearch={() => {}}
              />

              <FormControl 
                sx={{ 
                  minWidth: 120,
                  '& .MuiInputBase-root': {
                    height: '40px', // Match the height of other inputs
                  },
                  '& .MuiInputLabel-root': {
                    transform: 'translate(14px, 12px) scale(1)',
                    '&.MuiInputLabel-shrink': {
                      transform: 'translate(14px, -9px) scale(0.75)',
                    },
                  },
                }}
              >
                <InputLabel>Filter by Role</InputLabel>
                <Select
                  value={roleFilter}
                  label="Filter by Role"
                  onChange={(e) =>
                    setRoleFilter(e.target.value as Role | "all")
                  }
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  {Object.values(Role).map((role) => (
                    <MenuItem key={role} value={role}>
                      {role.replace("_", " ")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Divider />

            <TableContainer>
              <Table
                sx={{ minWidth: 750 }}
                aria-labelledby="tableTitle"
                size="medium"
              >
                <EnhancedTableHead
                  numSelected={selected.length}
                  order={order}
                  orderBy={orderBy}
                  onSelectAllClick={handleSelectAllClick}
                  onRequestSort={handleRequestSort}
                  rowCount={users.length}
                  headCells={headCells}
                />
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.map((user, index) => {
                      const isItemSelected = isSelected(user.id);
                      const labelId = `enhanced-table-checkbox-${index}`;

                      return (
                        <TableRow
                          hover
                          onClick={(event) => handleClick(event, user.id)}
                          role="checkbox"
                          aria-checked={isItemSelected}
                          tabIndex={-1}
                          key={user.id}
                          selected={isItemSelected}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              color="primary"
                              checked={isItemSelected}
                              inputProps={{
                                "aria-labelledby": labelId,
                              }}
                            />
                          </TableCell>
                          <TableCell
                            component="th"
                            id={labelId}
                            scope="row"
                            padding="none"
                          >
                            <Box display="flex" alignItems="center">
                              <Typography variant="body2">
                                {user.fullname || "N/A"}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{user.email || "N/A"}</TableCell>
                          <TableCell>
                            <Chip
                              label={user.role.replace("_", " ")}
                              size="small"
                              sx={{
                                backgroundColor: getRoleColor(user.role),
                                color: "white",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.isActive ? "Active" : "Inactive"}
                              size="small"
                              color={user.isActive ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(user);
                              }}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRoleChange(user);
                              }}
                            >
                              <PersonAdd />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(user);
                              }}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {emptyRows > 0 && (
                    <TableRow
                      style={{
                        height: 53 * emptyRows,
                      }}
                    >
                      <TableCell colSpan={6} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </RoleProtectedRoute>
  );
}

EnhancedTable.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default EnhancedTable;
