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
import { Card } from "../../types/shared";
import TableHeadAction from "../../components/Table/members/TableHeader";
import Drawer from "src/components/Drawer";
import SubPage from "src/components/SubPage";
import {
  Edit as ArchiveIcon,
  Delete as RemoveRedEyeIcon,
} from "@mui/icons-material";
import CardForm from "../../components/pages/dashboard/card/CardForm";
import CardBanner from "src/components/pages/dashboard/card/Card";
import { LinkTab, a11yProps, TabPanel } from "src/components/Tabs";
import CardBank from "src/components/pages/dashboard/card/BankCard";

import { stableSort, getComparator } from "src/utils/table";
import { HeadCell } from "src/types/table";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import { useDeleteCardMutation, useGetCardQuery } from "src/api";
import Loader from "src/components/Loader";
import Modal from "src/components/Modal/BasicModal";

const Divider = styled(MuiDivider)(spacing);

const Paper = styled(MuiPaper)(spacing);

const headCells: Array<HeadCell> = [
  {
    id: "isPhysical",
    numeric: false,
    disablePadding: true,
    label: "Type",
  },
  {
    id: "name",
    numeric: true,
    disablePadding: false,
    label: "Name of the owner",
  },
  {
    id: "cardNumberHidden",
    numeric: true,
    disablePadding: false,
    label: "Last 4 digits",
  },
  { id: "limits", numeric: true, disablePadding: false, label: "Card limit" },
  {
    id: "expiry",
    numeric: true,
    disablePadding: false,
    label: "Card expiration date",
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

const applyFilters = (keywordServices: Card[], filters: Filters): Card[] => {
  return keywordServices?.filter((keywordServices) => {
    let matches = true;
    const { query } = filters;
    if (query) {
      matches = Object.keys(keywordServices).some((key) => {
        if (typeof keywordServices[key] !== "string") return false;
        return keywordServices[key]
          .toString()
          .toLowerCase()
          .includes(query.toLowerCase());
      });
    }

    return matches;
  });
};

function EnhancedTable({ cards }: { cards: Card[] | undefined }) {
  const [order, setOrder] = React.useState<"desc" | "asc">("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [selected, setSelected] = React.useState<Array<string>>([]);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [filters, setFilters] = useState<Filters>({
    query: "",
  });
  const [openDeletModal, setOpenDeletModal] = React.useState<boolean>(false);
  const [editeCard, setEditeCard] = React.useState<Card | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteCard] = useDeleteCardMutation();

  const rows: Card[] = useMemo(() => cards || [], [cards]);

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

  const filteredRows = useMemo(
    () => applyFilters(rows, filters),
    [filters, rows]
  );

  const handleEdite = useCallback((data: Card) => {
    setEditeCard(data);
    setOpen(true);
  }, []);

  const handleAction = useCallback(() => {
    if (editeCard?.id) {
      deleteCard(editeCard?.id).finally(() => {
        setEditeCard(null);
        setOpenDeletModal(false);
      });
    }
  }, [editeCard, deleteCard]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredRows?.map(
        (n: Card) => n.internalTransactionId
      );
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleDelete = useCallback((data: Card) => {
    setEditeCard(data);
    setOpenDeletModal(true);
  }, []);

  const emptyRows =
    rowsPerPage -
    Math.min(rowsPerPage, filteredRows.length - page * rowsPerPage);

  return (
    <div>
      <Modal
        open={openDeletModal}
        handleClose={() => setOpenDeletModal(false)}
        handleAction={handleAction}
        title={"Delete Card"}
        contentText={`Are you sure you want to remove this card`}
      />
      <Drawer
        open={open}
        handleClose={() => {
          setOpen(false);
        }}
      >
        <SubPage title="Card">
          <CardForm
            handleClose={() => {
              setOpen(false);
              setEditeCard(null);
            }}
            selectItem={editeCard}
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
                      onDoubleClick={(event) => handleClick(event, row.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={row.fullName}
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
                        {row.isPhysical ? "physical" : "virtual"}
                      </TableCell>
                      <TableCell align="right">{row.name}</TableCell>
                      <TableCell align="right">
                        {row.cardNumberHidden}
                      </TableCell>
                      <TableCell align="right">{row.limits.total}</TableCell>
                      <TableCell align="right">{row.expiry}</TableCell>
                      <TableCell padding="none" align="right">
                        <Box mr={2}>
                          <IconButton
                            onClick={() => handleEdite(row)}
                            aria-label="delete"
                            size="large"
                          >
                            <ArchiveIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDelete(row)}
                            aria-label="details"
                            size="large"
                          >
                            <RemoveRedEyeIcon />
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
        <LinkTab label="List Card" {...a11yProps(0)} />
        <LinkTab label="Card" {...a11yProps(1)} />
      </Tabs>

      <Divider my={6} />
      <TabPanel value={value} index={0} title={"List"}>
        {cardsBannerList.map((card, index) => (
          <Grid key={card.id} item xs={4}>
            <CardBanner card={card} />
          </Grid>
        ))}

        {cardsBannerList.length > 0 && <Divider my={6} />}

        <Grid container spacing={6}>
          <Grid item xs={12}>
            <EnhancedTable cards={cardsList} />
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
