import React, { useMemo, useState } from "react";
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
  Avatar,
  Box,
} from "@mui/material";

import { spacing } from "@mui/system";

import DashboardLayout from "../../layouts/Dashboard";
import { Filters, Transactions } from "../../types/shared";
import TableHeadAction from "src/components/Table/TableHead";
import Label from "src/components/label";
import Loader from "src/components/Loader";

import {
  stableSort,
  getComparator,
  isDateInCurrentWeek,
  isDateInCurrentMonth,
  isDateInCurrentYear,
} from "src/utils/table";
import { HeadCell } from "src/types/table";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import { useGetTransactionsQuery } from "src/api";

const Divider = styled(MuiDivider)(spacing);

const Paper = styled(MuiPaper)(spacing);

const headCells: Array<HeadCell> = [
  {
    id: "creditorName",
    numeric: false,
    disablePadding: true,
    label: "Merchant",
  },
  { id: "cardNo", numeric: true, disablePadding: false, label: "Card" },
  {
    id: "debtorName",
    numeric: true,
    disablePadding: false,
    label: "Member",
  },
  {
    id: "bookingDate",
    numeric: true,
    disablePadding: false,
    label: "Processed date",
  },
  { id: "status", numeric: true, disablePadding: false, label: "Status" },
];

const keyFilter = ["debtorName", "cardNo", "status"];

const applyFilters = (
  keywordServices: Transactions[],
  filters: Filters
): Transactions[] => {
  return keywordServices?.filter((keywordServices) => {
    let matches = true;
    const { query, date, myTransaction } = filters;
    if (query) {
      matches = keyFilter.some((key) => {
        console.log("keywordServices[key]", keywordServices[key]);
        return keywordServices[key]
          .toString()
          .toLowerCase()
          .includes(query.toLowerCase());
      });
    }
    if (date) {
      matches = matches
        ? date === "Last Week"
          ? isDateInCurrentWeek(keywordServices.bookingDate)
          : date === "Last Month"
          ? isDateInCurrentMonth(keywordServices.bookingDate)
          : isDateInCurrentYear(keywordServices.bookingDate)
        : false;
    }
    if (myTransaction) {
      matches = matches
        ? keywordServices.id === "c308"
          ? true
          : false
        : false;
    }

    return matches;
  });
};

export type ServiceStatus = "Done" | "Missing details" | "Rejected";

const getStatusLabel = (ServiceStatus: ServiceStatus): JSX.Element => {
  const map = {
    Rejected: {
      text: "Rejected",
      color: "error",
    },
    Done: {
      text: "Done",
      color: "success",
    },
    "Missing details": {
      text: "Missing details",
      color: "warning",
    },
  };

  const { text, color }: any = map[ServiceStatus];

  return <Label color={color}>{text}</Label>;
};

function EnhancedTable() {
  const [order, setOrder] = React.useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [selected, setSelected] = React.useState<Array<string>>([]);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [filters, setFilters] = useState<Filters>({
    query: "",
    myTransaction: false,
  });
  const { isLoading, data } = useGetTransactionsQuery();
  const rows = data?.transactions || [];
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
    // setOpen(true);
    // setOpenEdit(true);
  };

  const onHandleSearch = (event: ChangeEvent<HTMLInputElement>): void => {
    setFilters((filters) => ({ ...filters, query: event.target.value }));
  };
  const onHandleDate = (value: string): void => {
    setFilters((filters) => ({ ...filters, date: value }));
  };
  const onHandleMyTransaction = (value: boolean): void => {
    setFilters((filters) => ({ ...filters, myTransaction: value }));
  };

  const filteredRows = useMemo(
    () => applyFilters(rows, filters),
    [filters, rows]
  );

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredRows?.map(
        (n: Transactions) => n.transactionId
      );
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };
  const emptyRows =
    rowsPerPage -
    Math.min(rowsPerPage, filteredRows.length - page * rowsPerPage);

  if (isLoading) return <Loader />;
  return (
    <div>
      <Paper>
        <TableHeadAction
          search={filters.query}
          handleClickOpen={handleClickOpen}
          onHandleSearch={onHandleSearch}
          onHandleDate={onHandleDate}
          onHandleMyTransaction={onHandleMyTransaction}
          filters={filters}
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
                  const isItemSelected = isSelected(row.transactionId);
                  const labelId = `enhanced-table-checkbox-${index}`;

                  return (
                    <TableRow
                      hover
                      onClick={(event) => handleClick(event, row.transactionId)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.name}
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
                        <Box display="flex" alignItems="center">
                          <Avatar
                            sx={{ height: "20px", width: "20px", mr: "10px" }}
                            alt="Remy Sharp"
                            src={row.avatar}
                          />
                          {row.creditorName}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{row.cardNo}</TableCell>
                      <TableCell align="right">{row.debtorName}</TableCell>
                      <TableCell align="right">{row.bookingDate}</TableCell>
                      <TableCell align="right">
                        {getStatusLabel(row.status as ServiceStatus)}
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
          rowsPerPageOptions={[5, 10, 25]}
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

function TransactionsPage() {
  return (
    <React.Fragment>
      <Helmet title="Transactions" />
      <Typography variant="h3" gutterBottom display="inline">
        Transactions
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

TransactionsPage.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default TransactionsPage;
