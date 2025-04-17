import React, { useCallback, useMemo, useState } from "react";
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
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";

import { spacing } from "@mui/system";

import DashboardLayout from "../../layouts/Dashboard";

import { Member } from "../../types/shared";
import TableHeadAction from "../../components/Table/members/TableHeader";
import Drawer from "src/components/Drawer";
import SubPage from "src/components/SubPage";
import UserForm from "src/components/pages/dashboard/members/UserForm";

import { stableSort, getComparator } from "src/utils/table";
import { HeadCell } from "src/types/table";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import { useDeleteMemeberMutation, useGetMembersQuery } from "src/api";
import { red } from "@mui/material/colors";
import Modal from "src/components/Modal/BasicModal";
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

const Divider = styled(MuiDivider)(spacing);

const Paper = styled(MuiPaper)(spacing);

const headCells: Array<HeadCell> = [
  {
    id: "fullName",
    numeric: false,
    disablePadding: true,
    label: "Full name",
    alignment: "left",
  },
  {
    id: "email",
    numeric: false,
    disablePadding: false,
    label: "Email",
    alignment: "left",
  },
  {
    id: "plan",
    numeric: false,
    disablePadding: false,
    label: "Plan",
    alignment: "left",
  },
  {
    id: "actions",
    alignment: "right",
    numeric: true,
    disablePadding: false,
    label: "Actions",
  },
];

interface Filters {
  query?: string | undefined;
}

const applyFilters = (
  keywordServices: Member[],
  filters: Filters
): Member[] => {
  return keywordServices.filter((keywordServices) => {
    let matches = true;
    const { query } = filters;
    if (query) {
      matches = Object.keys(keywordServices).some((key) => {
        return keywordServices[key]
          ?.toString()
          .toLowerCase()
          .includes(query.toLowerCase());
      });
    }

    return matches;
  });
};

function EnhancedTable() {
  const [order, setOrder] = React.useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [openDeletModal, setOpenDeletModal] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<Array<string>>([]);
  const [memberSelected, setEditeMember] = React.useState<Member | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(50);
  const [filters, setFilters] = useState<Filters>({
    query: "",
  });
  const [open, setOpen] = useState(false);

  const { data: members, isLoading, error } = useGetMembersQuery();
  const [deleteMember] = useDeleteMemeberMutation();

  const rows: Member[] = useMemo(() => members || [], [members]);

  const handleRequestSort = (event: any, property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleClick = (
    event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    id: string
  ) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: Array<string> = [];

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

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  const handleClickOpen = () => {
    setOpen(true);
  };

  const onHandleSearch = (event: ChangeEvent<HTMLInputElement>): void => {
    setFilters((filters) => ({ ...filters, query: event.target.value }));
  };

  const filteredRows: Member[] = useMemo(
    () => applyFilters(rows, filters),
    [filters, rows]
  );

  const handleEdite = useCallback((data: Member) => {
    setEditeMember(data);
    setOpen(true);
  }, []);

  const handleDelete = useCallback((data: Member) => {
    setEditeMember(data);
    setOpenDeletModal(true);
  }, []);

  const handleAction = useCallback(() => {
    if (memberSelected) {
      deleteMember(memberSelected.id).finally(() => {
        setEditeMember(null);
        setOpenDeletModal(false);
      });
    }
  }, [memberSelected, deleteMember]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredRows?.map((n: Member) => n.id);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const emptyRows =
    rowsPerPage -
    Math.min(rowsPerPage, filteredRows.length - page * rowsPerPage);

  return (


    <div>
      <Modal
        open={openDeletModal}
        handleClose={() => setOpenDeletModal(false)}
        handleAction={handleAction}
        title={"Delete Member"}
        contentText={`Are you sure you want to remove ${memberSelected?.fullName}`}
      />
      <Drawer
        open={open}
        handleClose={() => {
          setOpen(false);
        }}
      >
        <SubPage title="Manage memeber">
          <UserForm
            handleClose={() => {
              setOpen(false);
              setEditeMember(null);
            }}
            selectItem={memberSelected}
          />
        </SubPage>
      </Drawer>
      <Paper>
        <TableHeadAction
          search={filters.query}
          handleClickOpen={handleClickOpen}
          onHandleSearch={onHandleSearch}
        />
        <TableContainer>
          <Table aria-labelledby="tableTitle" aria-label="enhanced table">
            <EnhancedTableHead
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={filteredRows.length}
              headCells={headCells}
            />
            <TableBody>
              {stableSort(filteredRows, getComparator(order, orderBy))
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  const isItemSelected = isSelected(row.id);
                  const labelId = `enhanced-table-checkbox-${index}`;

                  return (
                    <TableRow
                      hover
                      onClick={(event) => handleClick(event, row.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.id}
                      selected={isItemSelected}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isItemSelected}
                          inputProps={{ "aria-labelledby": labelId }}
                        />
                      </TableCell>
                      <TableCell
                        component="th"
                        id={labelId}
                        scope="row"
                        padding="none"
                      >
                        {row.fullName}
                      </TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.plan}</TableCell>
                      <TableCell padding="none" align="right">
                        <Box mr={2}>
                          <IconButton
                            onClick={() => handleEdite(row)}
                            aria-label="delete"
                            size="large"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDelete(row)}
                            aria-label="delete"
                            size="large"
                          >
                            <Delete sx={{ color: red[400] }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {emptyRows > 0 && (
                <TableRow style={{ height: 53 * emptyRows }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[50, 100, 400]}
          component="div"
          count={filteredRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </div>
  );
}

function MembersPage() {
  return (

    <React.Fragment>
      <Helmet title="Transactions" />
      <Typography variant="h3" gutterBottom display="inline">
        Members
      </Typography>

      <Divider my={6} />

      <Grid container spacing={6}>
        <Grid item xs={12}>
          <EnhancedTable />
        </Grid>
      </Grid>
    </React.Fragment>

  );
}

MembersPage.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout><RoleProtectedRoute allowedRoles={['ADMIN']}>{page}</RoleProtectedRoute></DashboardLayout>;
};

export default MembersPage;