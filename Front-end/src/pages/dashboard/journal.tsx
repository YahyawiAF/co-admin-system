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
  IconButton,
  Tabs,
  Box,
} from "@mui/material";

import { spacing } from "@mui/system";

import DashboardLayout from "../../layouts/Dashboard";
import { Journal } from "../../types/shared";
import TableHeadAction from "../../components/Table/members/TableHeader";
import Drawer from "src/components/Drawer";
import SubPage from "src/components/SubPage";
import {
  Edit as ArchiveIcon,
  Delete,
  Edit,
  Delete as RemoveRedEyeIcon,
  Done,
} from "@mui/icons-material";
import { LinkTab, a11yProps, TabPanel } from "src/components/Tabs";
// import CardBank from "src/components/pages/dashboard/card/BankCard";

import { stableSort, getComparator } from "src/utils/table";
import { HeadCell } from "src/types/table";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import Loader from "src/components/Loader";
import Modal from "src/components/Modal/BasicModal";
import JournalForm from "src/components/pages/dashboard/journal/journalForm";
import { red } from "@mui/material/colors";
import { format } from "date-fns";
import {
  useDeleteJournalMutation,
  useGetJournalQuery,
} from "src/api/journal.repo";
import JournalDetails from "src/components/pages/dashboard/journal/JournalDetails";
import UserForm from "src/components/pages/dashboard/members/UserForm";

const Divider = styled(MuiDivider)(spacing);

const Paper = styled(MuiPaper)(spacing);

const headCells: Array<HeadCell> = [
  {
    id: "members.fullName",
    numeric: false,
    disablePadding: true,
    label: "Name",
  },
  {
    id: "registredTime",
    numeric: false,
    disablePadding: true,
    label: "Registred Time",
  },
  {
    id: "payedAmount",
    numeric: false,
    disablePadding: true,
    label: "Payed Amount",
  },
  {
    id: "leaveTime",
    numeric: false,
    disablePadding: true,
    label: "leave Time",
  },
  {
    id: "isPayed",
    numeric: false,
    disablePadding: true,
    label: "is Payed",
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
  keywordServices: Journal[],
  filters: Filters
): Journal[] => {
  return keywordServices?.filter((keywordServices) => {
    let matches = true;
    const { query } = filters;
    if (query) {
      matches = Object.keys(keywordServices).some((key) => {
        return keywordServices[key]
          .toString()
          .toLowerCase()
          .includes(query.toLowerCase());
      });
    }

    return matches;
  });
};

function JournalPage() {
  const [order, setOrder] = React.useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [openDeletModal, setOpenDeletModal] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<Array<string>>([]);
  const [editeJournal, setEditeJournal] = React.useState<Journal | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [today, setToday] = React.useState<Date>(new Date());
  const [filters, setFilters] = useState<Filters>({
    query: "",
  });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);

  const {
    data: Journals,
    isLoading,
    error,
    refetch,
  } = useGetJournalQuery({
    page,
    perPage: rowsPerPage,
    journalDate: today.toDateString(),
  });
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };
  const [deleteJournal] = useDeleteJournalMutation();

  const rows: Journal[] = useMemo(() => Journals?.data || [], [Journals]);

  console.log({ rows });

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

  const filteredRows: Journal[] = useMemo(
    () => applyFilters(rows, filters),
    [filters, rows]
  );

  const handleEdite = useCallback((data: Journal) => {
    setEditeJournal(data);
    setOpen(true);
  }, []);

  const handleDelete = useCallback((data: Journal) => {
    setEditeJournal(data);
    setOpenDeletModal(true);
  }, []);

  const handleAction = useCallback(() => {
    if (editeJournal) {
      deleteJournal(editeJournal.id).finally(() => {
        setEditeJournal(null);
        setOpenDeletModal(false);
      });
    }
  }, [editeJournal, deleteJournal]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredRows?.map((n: Journal) => n.id);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleChangeDate = (date: Date | null) => {
    if (date) setToday(date);
  };

  const emptyRows =
    rowsPerPage -
    Math.min(rowsPerPage, filteredRows.length - page * rowsPerPage);

  return (
    <React.Fragment>
      <Helmet title="Transactions" />
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="basic tabs example"
      >
        <LinkTab label="Journal" {...a11yProps(0)} />
        <LinkTab label="Overview" {...a11yProps(1)} />
      </Tabs>

      <Divider my={6} />
      <TabPanel value={value} index={0} title={"List"}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <div>
              <Modal
                open={openDeletModal}
                handleClose={() => setOpenDeletModal(false)}
                handleAction={handleAction}
                title={"Delete Journal"}
                contentText={`Are you sure you want to remove ${editeJournal?.fullName}`}
              />
              <Drawer
                open={open}
                handleClose={() => {
                  setOpen(false);
                }}
              >
                <SubPage title="Manage memeber">
                  <JournalForm
                    handleClose={() => {
                      setOpen(false);
                      setEditeJournal(null);
                    }}
                    selectItem={editeJournal}
                  />
                </SubPage>
              </Drawer>
              <Paper>
                <TableHeadAction
                  handleChangeDate={handleChangeDate}
                  toDay={today}
                  search={filters.query}
                  handleClickOpen={handleClickOpen}
                  onHandleSearch={onHandleSearch}
                  refetch={refetch}
                />
                <TableContainer>
                  <Table
                    aria-labelledby="tableTitle"
                    aria-label="enhanced table"
                  >
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
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((row, index) => {
                          const isItemSelected = isSelected(row.id);
                          const labelId = `enhanced-table-checkbox-${index}`;

                          const pastDate = new Date(row?.createdAt);

                          // Get the current date and time
                          const currentDate = new Date();

                          // Calculate the difference in milliseconds
                          const differenceInMilliseconds =
                            currentDate.getTime() - pastDate.getTime();

                          // Convert the difference from milliseconds to hours
                          const differenceInHours =
                            differenceInMilliseconds / (1000 * 60 * 60);

                          const toBePayed = differenceInHours < 6 ? 4 : 8;

                          const hours = Math.floor(differenceInHours);
                          differenceInHours;
                          // Extract the minutes by taking the remainder of the hours and converting it to minutes
                          const minutes = Math.round(
                            (differenceInHours - hours) * 60
                          );

                          // Format the time as HH:mm
                          const formattedTime = `${String(hours).padStart(
                            2,
                            "0"
                          )}:${String(minutes).padStart(2, "0")}`;

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
                                {row.members.fullName}
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(row.createdAt) as Date,
                                  "HH:mm:ss"
                                )}
                              </TableCell>
                              <TableCell>
                                {row.price
                                  ? row.price + " DT"
                                  : toBePayed + " DT"}
                              </TableCell>
                              <TableCell>{formattedTime}</TableCell>

                              <TableCell>
                                {row.isPayed ? <Done /> : null}
                              </TableCell>
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
          </Grid>
        </Grid>
      </TabPanel>
      <TabPanel value={value} index={1} title={"Card"}>
        <JournalDetails
          journals={rows}
          isLoading={isLoading}
          errorMemberReq={!!error}
        />
      </TabPanel>
    </React.Fragment>
  );
}

JournalPage.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default JournalPage;
