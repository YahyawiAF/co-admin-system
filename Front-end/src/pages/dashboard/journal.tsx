import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  FormControl,
  Select,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { spacing } from "@mui/system";
;

import DashboardLayout from "../../layouts/Dashboard";
import { Expenses, Journal } from "../../types/shared";
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
  useUpdateJournalMutation,
} from "src/api/journal.repo";
import JournalDetails from "src/components/pages/dashboard/journal/JournalDetails";
import { getHourDifference } from "src/utils/shared";
import Abonnement from "./abonnement";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
} from "src/api/expenseApi";
import { ExpenseType } from "src/types/shared";
import AddIcon from "@mui/icons-material/Add";
import ShopFilterSidebar from "src/components/Drawer";
import { LoadingButton } from "@mui/lab";
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
  return Object.keys(obj).some((key) => {
    return obj[key]?.toString().toLowerCase().includes(query.toLowerCase());
  });
}
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
const applyFilters = (
  keywordServices: Journal[],
  filters: Filters
): Journal[] => {
  return keywordServices?.filter((keywordServices) => {
    let matches = true;
    const { query } = filters;
    if (query) {
      matches = Object.keys(keywordServices).some((key) => {
        if (key === "members")
          return doesObjectContainQuery(keywordServices["members"], query);
        else
          return keywordServices[key]
            ?.toString()
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
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [today, setToday] = React.useState<Date>(new Date());
  const [filters, setFilters] = useState<Filters>({
    query: "",
  });
  const [openExpenseModal, setOpenExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<string>("");
  const [newDailyExpense, setNewDailyExpense] = useState({
    name: "",
    amount: 0,
    description: "",
  });
  const { data: expenses } = useGetExpensesQuery();
  const [createExpense] = useCreateExpenseMutation();

  const dailyExpenses = expenses?.filter(
    (expense) => expense.type === ExpenseType.JOURNALIER
  );
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
  // Ajoutez ce hook useEffect en haut du composant
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString('en-CA'));


  const [updateJournal] = useUpdateJournalMutation();
  // Modifiez la fonction handleConfirmExpense
  const handleConfirmExpense = async () => {
    try {
      let newExpense: Expenses;

      if (selectedExpense === "new") {
        newExpense = await createExpense({
          ...newDailyExpense,
          type: ExpenseType.JOURNALIER,
        }).unwrap();
      } else {
        // Vérifier si la dépense est déjà dans le journal du jour
        const isExpenseAlreadyAdded = rows.some(journal =>
          journal.expenseIds?.includes(selectedExpense)
        );

        if (isExpenseAlreadyAdded) {
          alert("Cette dépense a déjà été ajoutée aujourd'hui");
          return;
        }

        const selected = dailyExpenses?.find(e => e.id === selectedExpense);
        if (!selected) return;

        newExpense = await createExpense({
          name: selected.name,
          amount: selected.amount,
          description: selected.description,
          type: ExpenseType.JOURNALIER,
        }).unwrap();
      }

      setSelectedExpense("");
      setNewDailyExpense({ name: "", amount: 0, description: "" });
      setOpenExpenseModal(false);
    } catch (error) {
      console.error("Erreur création dépense:", error);
    }
  };
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

  if (isLoading) return <Loader />;
  return (
    <React.Fragment>
      <Helmet title="Transactions" />
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="basic tabs example"
      >
        <LinkTab label="Journal" {...a11yProps(0)} />
        <LinkTab label="Membership" {...a11yProps(1)} />
        <LinkTab label="Overview" {...a11yProps(2)} />
      </Tabs>

      <Divider my={6} />
      <TabPanel value={value} index={0} title={"List"}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <div>
              {/* Modal de suppression */}
              <Modal
                open={openDeletModal}
                handleClose={() => setOpenDeletModal(false)}
                handleAction={handleAction}
                title={"Delete Journal"}
                contentText={`Are you sure you want to remove ${editeJournal?.fullName}`}
              />

              {/* Drawer pour les dépenses */}
              <ShopFilterSidebar
                open={openExpenseModal}
                handleClose={() => {
                  setOpenExpenseModal(false);
                  setSelectedExpense("");
                  setNewDailyExpense({ name: "", amount: 0, description: "" });
                }}
                anchor="right"
              >
                <SubPage title="Gestion des Dépenses Journalières">
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <FormControl fullWidth>

                      <Select
                        value={selectedExpense}
                        onChange={(e) => setSelectedExpense(e.target.value as string)}
                        displayEmpty
                      >
                        <MenuItem value="" disabled>
                          Sélectionner une dépense existante
                        </MenuItem>
                        <MenuItem value="new">+ Créer nouvelle dépense</MenuItem>
                        {dailyExpenses
                          ?.filter(expense =>
                            !rows.some(journal => journal.expenseIds?.includes(expense.id))
                          )
                          .map((expense) => (
                            <MenuItem key={expense.id} value={expense.id}>
                              {expense.name} ({expense.amount} DT)
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>

                    {selectedExpense === "new" && (
                      <>
                        <TextField
                          label="Nom de la dépense"
                          fullWidth
                          required
                          value={newDailyExpense.name}
                          onChange={(e) =>
                            setNewDailyExpense({ ...newDailyExpense, name: e.target.value })
                          }
                        />
                        <TextField
                          label="Montant (DT)"
                          type="number"
                          fullWidth
                          required
                          value={newDailyExpense.amount}
                          onChange={(e) =>
                            setNewDailyExpense({
                              ...newDailyExpense,
                              amount: Number(e.target.value),
                            })
                          }
                          InputProps={{
                            inputProps: { min: 0, step: 0.01 },
                          }}
                        />
                        <TextField
                          label="Description"
                          multiline
                          rows={4}
                          fullWidth
                          value={newDailyExpense.description}
                          onChange={(e) =>
                            setNewDailyExpense({ ...newDailyExpense, description: e.target.value })
                          }
                        />
                      </>
                    )}

                    <Box display="flex" gap={2} mt={3}>
                      <SubmitButton
                        variant="contained"
                        size="large"
                        onClick={handleConfirmExpense}
                        disabled={selectedExpense === ""}
                      >
                        Confirmer
                      </SubmitButton>
                      <ActionButton
                        variant="outlined"
                        color="secondary"
                        onClick={() => setOpenExpenseModal(false)}
                      >
                        Annuler
                      </ActionButton>
                    </Box>
                  </Box>
                </SubPage>
              </ShopFilterSidebar>
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
                <Box display="flex" alignItems="center" p={2}>
                  <TableHeadAction
                    handleChangeDate={handleChangeDate}
                    toDay={today}
                    search={filters.query}
                    handleClickOpen={handleClickOpen}
                    onHandleSearch={onHandleSearch}
                    refetch={refetch}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenExpenseModal(true)}
                    sx={{
                      ml: 2,
                      bgcolor: "#054547",
                      "&:hover": { bgcolor: "#083231" }
                    }}
                  >
                    Add Expense
                  </Button>
                </Box>

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
                              // onClick={(event) => handleClick(event, row.id)}
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
                              {/* <TableCell>{leaveDate}</TableCell> */}
                              <TableCell>{hoursDifference}</TableCell>

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
        <Abonnement />
      </TabPanel>

      <TabPanel value={value} index={2} title={"Overview"}>
        <JournalDetails
          journals={rows}
          dailyExpenses={dailyExpenses || []}
          isLoading={isLoading}
          errorMemberReq={!!error}
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
