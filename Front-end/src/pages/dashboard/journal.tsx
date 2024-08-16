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
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  IconButton,
  Tabs,
  Box,
} from "@mui/material";

import { spacing } from "@mui/system";

import DashboardLayout from "../../layouts/Dashboard";

import { useAppSelector } from "../../redux/hooks";
import { Card, User } from "../../types/shared";
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
import CardForm from "../../components/pages/dashboard/card/CardForm";
import CardBanner from "src/components/pages/dashboard/card/Card";
import { LinkTab, a11yProps, TabPanel } from "src/components/Tabs";
import CardBank from "src/components/pages/dashboard/card/BankCard";

import { stableSort, getComparator } from "src/utils/table";
import { HeadCell } from "src/types/table";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import {
  useDeleteCardMutation,
  useDeleteMemeberMutation,
  useGetCardQuery,
  useGetMembersQuery,
} from "src/api";
import Loader from "src/components/Loader";
import Modal from "src/components/Modal/BasicModal";
import JournalForm from "src/components/pages/dashboard/journal/journalForm";
import { green, red } from "@mui/material/colors";
import { format } from "date-fns";

const Divider = styled(MuiDivider)(spacing);

const Paper = styled(MuiPaper)(spacing);

const headCells: Array<HeadCell> = [
  {
    id: "fullName",
    numeric: false,
    disablePadding: true,
    label: "Full name",
  },
  {
    id: "starting",
    numeric: true,
    disablePadding: false,
    label: "Starting",
  },
  {
    id: "hours",
    numeric: true,
    disablePadding: false,
    label: "Passed hours",
  },
  {
    id: "price",
    numeric: true,
    disablePadding: false,
    label: "Payment",
  },
  {
    id: "payed",
    numeric: true,
    disablePadding: false,
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

const applyFilters = (keywordServices: User[], filters: Filters): User[] => {
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

function EnhancedTable() {
  const [order, setOrder] = React.useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [openDeletModal, setOpenDeletModal] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<Array<string>>([]);
  const [editeUser, setEditeUser] = React.useState<User | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [today, setToday] = React.useState<Date>(new Date());
  const [filters, setFilters] = useState<Filters>({
    query: "",
  });
  const [open, setOpen] = useState(false);

  const { data: members, isLoading, error, refetch } = useGetMembersQuery();
  const [deleteMember] = useDeleteMemeberMutation();

  const rows: User[] = useMemo(
    () =>
      members?.filter(
        (data) =>
          new Date(data?.createdOn).getUTCFullYear() ===
            today.getUTCFullYear() &&
          new Date(data?.createdOn).getUTCMonth() === today.getUTCMonth() &&
          new Date(data?.createdOn).getUTCDay() === today.getUTCDay()
      ) || [],
    [members, today]
  );

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

  const filteredRows: User[] = useMemo(
    () => applyFilters(rows, filters),
    [filters, rows]
  );

  const handleEdite = useCallback((data: User) => {
    setEditeUser(data);
    setOpen(true);
  }, []);

  const handleDelete = useCallback((data: User) => {
    setEditeUser(data);
    setOpenDeletModal(true);
  }, []);

  const handleAction = useCallback(() => {
    if (editeUser) {
      deleteMember(editeUser.id).finally(() => {
        setEditeUser(null);
        setOpenDeletModal(false);
      });
    }
  }, [editeUser, deleteMember]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredRows?.map((n: User) => n.id);
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
    <div>
      <Modal
        open={openDeletModal}
        handleClose={() => setOpenDeletModal(false)}
        handleAction={handleAction}
        title={"Delete User"}
        contentText={`Are you sure you want to remove ${editeUser?.fullName}`}
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
              setEditeUser(null);
            }}
            selectItem={editeUser}
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

                  const pastDate = new Date(row?.starting as string);

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
                  const minutes = Math.round((differenceInHours - hours) * 60);

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
                        {row.fullName}
                      </TableCell>
                      <TableCell align="right">
                        {format(
                          new Date(row.starting as string) as Date,
                          "HH:mm:ss"
                        )}
                      </TableCell>
                      <TableCell align="right">{formattedTime}</TableCell>
                      <TableCell align="right">
                        {row.price ? row.price + " DT" : toBePayed + " DT"}
                      </TableCell>
                      <TableCell align="right">
                        {row.payed ? <Done /> : null}
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
  );
}

function CardPage() {
  const [value, setValue] = useState(0);
  const { data: cards, isLoading, error, isError } = useGetCardQuery();
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };
  const cardsList = useMemo(
    () =>
      cards && cards?.length > 0
        ? cards?.filter((c) => !c.status || c.status !== "pending approval")
        : [],
    [cards]
  );

  const cardsBannerList = useMemo(
    () =>
      cards && cards?.length > 0
        ? cards?.filter((c) => c.status === "pending approval")
        : [],
    [cards]
  );

  if (isLoading) return <Loader />;
  if (isError) return <div> error</div>;
  return (
    <React.Fragment>
      <Helmet title="Transactions" />
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="basic tabs example"
      >
        <LinkTab label="Active" {...a11yProps(0)} />
        <LinkTab label="Finished" {...a11yProps(1)} />
      </Tabs>

      <Divider my={6} />
      <TabPanel value={value} index={0} title={"List"}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <EnhancedTable />
          </Grid>
        </Grid>
      </TabPanel>
      <TabPanel value={value} index={1} title={"Card"}>
        <Grid container spacing={6}>
          {cardsList.map((card, index) => (
            <Grid key={card.id} item xs={4}>
              <CardBank card={card} />
            </Grid>
          ))}
        </Grid>
      </TabPanel>
    </React.Fragment>
  );
}

CardPage.getLayout = function getLayout(page: ReactElement) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default CardPage;
