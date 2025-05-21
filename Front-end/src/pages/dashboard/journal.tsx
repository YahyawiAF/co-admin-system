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
  Button,
} from "@mui/material";
import { spacing } from "@mui/system";
import DashboardLayout from "../../layouts/Dashboard";
import { DailyExpense, Journal, DailyProduct } from "../../types/shared";
import TableHeadAction from "../../components/Table/members/TableHeader";
import Drawer from "src/components/Drawer";
import SubPage from "src/components/SubPage";
import { Edit as ArchiveIcon, Delete, Edit, Done, KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { LinkTab, a11yProps, TabPanel } from "src/components/Tabs";
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
import { getHourDifference } from "src/utils/shared";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import Abonnement from "./abonnement";
import { useGetExpensesQuery } from "src/api/expenseApi";
import {
  useCreateDailyExpenseMutation,
  useGetAllDailyExpensesQuery,
} from "src/api/dailyexpenseApi";
import { useGetDailyProductsQuery } from "src/api/productApi";
import DailyExpenseModal from "../../components/pages/dashboard/journal/dailyexpense";
import Fuse from "fuse.js";
import SeatingChart from "./map";
import { MobileDatePicker } from "@mui/x-date-pickers";

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
    id: "stayed",
    numeric: false,
    disablePadding: true,
    label: "StayedTime",
  },
  {
    id: "isPayed",
    numeric: false,
    disablePadding: true,
    label: "Payed",
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

function doesObjectContainQuery(obj: Record<any, any>, query: string) {
  if (!query || query.length < 2) return false;

  return Object.keys(obj).some((key) => {
    const value = obj[key];
    if (value === null || value === undefined) return false;
    return value.toString().toLowerCase().includes(query.toLowerCase());
  });
}

const journalSearchOptions = {
  keys: [
    { name: "members.fullName", weight: 0.5 },
    { name: "registredTime", weight: 0.3 },
    { name: "payedAmount", weight: 0.2 },
    { name: "id", weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

function applyFilters(journals: Journal[], filters: Filters): Journal[] {
  if (!filters.query || filters.query.length < 2) {
    return journals;
  }

  const fuse = new Fuse(journals, journalSearchOptions);
  const results = fuse.search(filters.query);
  return results.map((result) => result.item);
}

function JournalPage() {
  const { data: dailyExpenses = [] } = useGetAllDailyExpensesQuery();
  const { data: dailyProducts = [] } = useGetDailyProductsQuery();
  const [dailyExpenseOpen, setDailyExpenseOpen] = useState(false);
  const { data: expenses = [] } = useGetExpensesQuery();
  const [createDailyExpense] = useCreateDailyExpenseMutation();
  const [order, setOrder] = React.useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [openDeletModal, setOpenDeletModal] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<Array<string>>([]);
  const [editeJournal, setEditeJournal] = React.useState<Journal | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [today, setToday] = React.useState<Date>(new Date());
  const [filters, setFilters] = useState<Filters>({
    query: "",
  });

  // Fonction pour comparer les dates
  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Filtrer les dailyExpenses par la date sélectionnée
  const filteredDailyExpenses = useMemo(() => {
    return dailyExpenses.filter((expense) => {
      const expenseDate = new Date(expense.date || expense.createdAt);
      return isSameDay(expenseDate, today);
    });
  }, [dailyExpenses, today]);

  // Filtrer les dailyProducts par la date sélectionnée
  const filteredDailyProducts = useMemo(() => {
    return dailyProducts.filter((product) => {
      const productDate = new Date(product.date || product.createdAt);
      return isSameDay(productDate, today);
    });
  }, [dailyProducts, today]);

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

  const handleCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>,
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
    if (date) {
      setToday(date);
      refetch(); // Refetch journals pour la nouvelle date
    }
  };

  const goToNextDay = () => {
    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);
    handleChangeDate(nextDay);
  };

  const goToPreviousDay = () => {
    const prevDay = new Date(today);
    prevDay.setDate(prevDay.getDate() - 1);
    handleChangeDate(prevDay);
  };

  const setCurrentDay = () => {
    handleChangeDate(new Date());
  };

  const handleDailyExpenseClick = () => {
    setDailyExpenseOpen(true);
  };

  const isCurrentDay = () => {
    const todayDate = new Date();
    return (
      today.getDate() === todayDate.getDate() &&
      today.getMonth() === todayDate.getMonth() &&
      today.getFullYear() === todayDate.getFullYear()
    );
  };

  const handleCreateDailyExpense = async (data: {
    expenseId: string;
    date?: string;
    Summary?: string;
  }) => {
    try {
      await createDailyExpense({
        ...data,
        date: data.date || format(today, "yyyy-MM-dd"), // Utiliser la date sélectionnée
      }).unwrap();
      setDailyExpenseOpen(false);
    } catch (error) {
      console.error("Failed to create daily expense:", error);
    }
  };

  const emptyRows =
    rowsPerPage -
    Math.min(rowsPerPage, filteredRows.length - page * rowsPerPage);

  if (isLoading) return <Loader />;

  return (
    <React.Fragment>
      <Helmet title="Transactions" />
      <Box display="flex" alignItems="center" gap="10px" mb={2}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        >
          <Button
            onClick={goToPreviousDay}
            variant="outlined"
            startIcon={<KeyboardArrowLeft />}
            style={{
              minWidth: "0px",
              padding: "0px",
              margin: "0",
              color: "blue",
              borderWidth: "0px",
              position: "absolute",
              left: "5px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
            }}
          />
          <MobileDatePicker
            value={today}
            onChange={(value) => handleChangeDate(value)}
            slotProps={{
              textField: {
                InputProps: {
                  disableUnderline: true,
                  style: {
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    padding: "0px 35px",
                    textAlign: "center",
                    color: "#333",
                    fontWeight: "bold",
                    backgroundColor: "transparent",
                    width: "180px",
                  },
                },
                size: "small",
                fullWidth: false,
              },
            }}
          />
          <Button
            onClick={goToNextDay}
            variant="outlined"
            endIcon={<KeyboardArrowRight />}
            style={{
              minWidth: "0px",
              padding: "0px",
              margin: "0",
              color: "blue",
              borderWidth: "0px",
              position: "absolute",
              right: "5px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
            }}
          />
        </div>
        <Button
          variant="outlined"
          color={isCurrentDay() ? "success" : "primary"}
          onClick={setCurrentDay}
          sx={{
            width: "120px",
            minWidth: "120px",
            padding: "6px 9px",
            marginLeft: "0px",
            backgroundColor: isCurrentDay()
              ? "rgba(46, 125, 50, 0.08)"
              : "inherit",
          }}
        >
          Current Day
        </Button>
        <Button
          variant="contained"
          onClick={handleDailyExpenseClick}
          sx={{ ml: 2 }}
        >
          Daily Expense
        </Button>
      </Box>
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="basic tabs example"
      >
        <LinkTab label="Journal" {...a11yProps(0)} />
        <LinkTab label="Membership" {...a11yProps(1)} />
        <LinkTab label="Reservations" {...a11yProps(2)} />
        <LinkTab label="Overview" {...a11yProps(3)} />
      </Tabs>
      <DailyExpenseModal
        open={dailyExpenseOpen}
        onClose={() => setDailyExpenseOpen(false)}
        expenses={expenses}
        onSubmit={handleCreateDailyExpense}
        initialData={{ expenseId: "", date: format(today, "yyyy-MM-dd") }}
      />
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
                <SubPage title="Manage member">
                  <JournalForm
                    handleClose={() => {
                      setOpen(false);
                      setEditeJournal(null);
                    }}
                    today={today}
                    selectItem={editeJournal}
                  />
                </SubPage>
              </Drawer>
              <Paper>
                <TableHeadAction
                  handleClickOpen={handleClickOpen}
                  onHandleSearch={onHandleSearch}
                  search={filters.query}
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
                          const dleave = row.isPayed
                            ? row.leaveTime ?? new Date()
                            : new Date();
                          const hoursDifference = row.isReservation
                            ? "Reservation"
                            : getHourDifference(row.registredTime, dleave);
                          return (
                            <TableRow
                              hover
                              onDoubleClick={() => handleEdite(row)}
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
                                  onChange={(event) =>
                                    handleCheckboxChange(event, row.id)
                                  }
                                />
                              </TableCell>
                              <TableCell
                                component="th"
                                id={labelId}
                                scope="row"
                                padding="none"
                              >
                                {row.members?.fullName}
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(row.registredTime) as Date,
                                  "HH:mm:ss"
                                )}
                              </TableCell>
                              <TableCell>
                                {row.payedAmount
                                  ? row.payedAmount + " DT"
                                  : 0 + " DT"}
                              </TableCell>
                              <TableCell>{hoursDifference}</TableCell>
                              <TableCell>
                                {row.isPayed ? <Done /> : null}
                              </TableCell>
                              <TableCell padding="none" align="right">
                                <Box mr={2}>
                                  <IconButton
                                    onClick={() => handleEdite(row)}
                                    aria-label="edit"
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
                  rowsPerPageOptions={[50, 100, 200, 500]}
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
      <TabPanel value={value} index={1} title={"Membership"}>
        <Abonnement selectedDate={today} />
      </TabPanel>
     <TabPanel value={value} index={2} title={"Reservations"}>
  <SeatingChart selectedDate={today} />
</TabPanel>
      <TabPanel value={value} index={3} title={"Overview"}>
        <JournalDetails
          journals={rows}
          isLoading={isLoading}
          errorMemberReq={!!error}
          dailyExpenses={filteredDailyExpenses}
          dailyProducts={filteredDailyProducts}
          expenses={expenses}
          selectedDate={today}
        />
      </TabPanel>
    </React.Fragment>
  );
}

JournalPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default JournalPage;