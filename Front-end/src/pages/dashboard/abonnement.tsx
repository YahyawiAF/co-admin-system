import React, { ReactElement, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { PersonAdd } from "@mui/icons-material";
import DashboardLayout from "../../layouts/Dashboard";

import {
  useGetAbonnementsQuery,
  useCreateAbonnementMutation,
  useUpdateAbonnementMutation,
  useDeleteAbonnementMutation,
} from "src/api/abonnement.repo";
import { useGetMembersQuery } from "src/api/members.repo";
import { useGetPricesQuery } from "src/api/price.repo";
import { Abonnement, Member, Price, Subscription } from "src/types/shared";
import {
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
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
  MenuItem,
  InputLabel,
  Select,
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
  keyframes,
  Checkbox,
  useMediaQuery,
  Theme,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DatePicker } from "@mui/x-date-pickers";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import TableHeadAction from "../../components/Table/members/TableHeader";

import UserForm from "src/components/pages/dashboard/members/UserForm";
import { HeadCell } from "src/types/table";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

// Styles responsives
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
    "&:nth-of-type(3)": { width: "20%" },
    "&:nth-of-type(4)": { display: "none" },
    "&:nth-of-type(5)": { display: "none" },
    "&:nth-of-type(6)": { display: "none" },
    "&:nth-of-type(7)": { width: "30%" },
  },
  // Ajoutez cette partie pour forcer l'alignement à droite pour la colonne actions
  '&[data-align="right"]': {
    textAlign: "right",
    justifyContent: "flex-end",
  },
}));

const ResponsiveActions = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  gap: theme.spacing(1),
  [theme.breakpoints.up("sm")]: {
    gap: theme.spacing(2),
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

const blinkAnimation = keyframes`
  0% { background-color: rgba(255, 0, 0, 0.1); }
  50% { background-color: rgba(255, 0, 0, 0.4); }
  100% { background-color: rgba(255, 0, 0, 0.1); }
`;

const BlinkingTableRow = styled(TableRow)(({ theme }) => ({
  animation: `${blinkAnimation} 1.5s ease-in-out infinite`,
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const PriceCard = styled(Card)(({ theme }) => ({
  cursor: "pointer",
  transition: "all 0.3s ease",
  "&:hover": {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

interface AbonnementFormData extends Partial<Abonnement> {
  registredDate: Date;
  leaveDate: Date;
  payedAmount: number;
}

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const AbonnementComponent = () => {
  const theme = useTheme();
  const [timeFilter, setTimeFilter] = useState<"week" | "month" | "all">("all");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [orderBy, setOrderBy] = useState<string>("registredDate");
  const [selected, setSelected] = useState<string[]>([]);
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  const {
    data: abonnementsData,
    isLoading,
    isError,
    refetch,
  } = useGetAbonnementsQuery({
    search: search,
  });

  const { data: members = [] } = useGetMembersQuery();
  const { data: prices = [] } = useGetPricesQuery();
  const abonnementPrices = prices.filter(
    (price) => price.type === "abonnement"
  );
  const [openUserForm, setOpenUserForm] = useState(false);
  const [member, setMember] = useState<Member | null>(null);

  const [createAbonnement] = useCreateAbonnementMutation();
  const [updateAbonnement] = useUpdateAbonnementMutation();
  const [deleteAbonnement] = useDeleteAbonnementMutation();
  const {
    data: membersList,
    isLoading: isLoadingMember,
    error: membersError,
  } = useGetMembersQuery();
  const [newAbonnement, setNewAbonnement] = useState<AbonnementFormData>({
    registredDate: new Date(),
    leaveDate: new Date(),
    payedAmount: 0,
    isPayed: false,
    isReservation: false,
    stayedPeriode: "",
  });
  // Remplacer la partie filteredData existante par ce code
  const filteredData = React.useMemo(() => {
    if (!abonnementsData?.data) return [];

    return abonnementsData.data.filter((abonnement) => {
      const price = prices.find((p) => p.id === abonnement.priceId);
      if (!price) return false;

      const priceName = price.name.toLowerCase();

      switch (timeFilter) {
        case "week":
          return priceName.includes("week");
        case "month":
          return priceName.includes("month");
        case "all":
        default:
          return true;
      }
    });
  }, [abonnementsData?.data, timeFilter, prices]);
  const [editAbonnement, setEditAbonnement] = useState<Abonnement | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [abonnementToDelete, setAbonnementToDelete] = useState<string | null>(
    null
  );
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openMemberModal, setOpenMemberModal] = useState(false);
  const headCells: Array<HeadCell> = [
    {
      id: "member",
      numeric: false,
      disablePadding: true,
      label: "Member",
    },
    {
      id: "registredDate",
      numeric: false,
      disablePadding: false,
      label: "Registered Date",
    },
    {
      id: "leaveDate",
      numeric: false,
      disablePadding: false,
      label: "Leave Date",
    },
    {
      id: "Stayed Periode",
      numeric: false,
      disablePadding: false,
      label: "Stayed Periode",
    },
    {
      id: "remainingTime",
      numeric: false,
      disablePadding: false,
      label: "Remaining Time",
    },
    {
      id: "payedAmount",
      numeric: false,
      disablePadding: false,
      label: "Paid Amount",
    },
    {
      id: "status",
      numeric: false,
      disablePadding: false,
      label: "Status",
    },

    {
      id: "actions",
      numeric: false,
      disablePadding: false,
      label: "Actions",
      alignment: "center",
    },
  ];

  const membersWithSubscriptionStatus = members
    // .filter((member) => member.plan === Subscription.Membership) // Ajoutez ce filtre
    .map((member) => ({
      ...member,
      hasSubscription: abonnementsData?.data.some(
        (abonnement) => abonnement.memberID === member.id
      ),
    }));

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString();
    } catch (e) {
      return "Invalid date";
    }
  };
  const handleSelect = (selectedMember: Member | null) => {
    setMember(selectedMember);
    if (editAbonnement) {
      setEditAbonnement({
        ...editAbonnement,
        memberID: selectedMember?.id || "",
      });
    } else {
      setNewAbonnement({
        ...newAbonnement,
        memberID: selectedMember?.id || "",
      });
    }
  };
  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: string
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = abonnementsData?.data.map((n) => n.id) || [];
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

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (
      !(editAbonnement
        ? editAbonnement.registredDate
        : newAbonnement.registredDate)
    ) {
      newErrors.registredDate = "Registration date is required";
    }

    const leaveDate = editAbonnement
      ? editAbonnement.leaveDate
      : newAbonnement.leaveDate;
    if (!leaveDate) {
      newErrors.leaveDate = "Leave date is required";
    } else if (
      new Date(leaveDate) <=
      new Date(
        editAbonnement?.registredDate ||
        newAbonnement.registredDate ||
        new Date()
      )
    ) {
      newErrors.leaveDate = "Leave date must be after registration date";
    }

    if (!(editAbonnement ? editAbonnement.memberID : newAbonnement.memberID)) {
      newErrors.memberID = "Member is required";
    }

    if (!(editAbonnement ? editAbonnement.priceId : newAbonnement.priceId)) {
      newErrors.priceId = "Price is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const selectedPrice = prices.find(
        (p) =>
          p.id ===
          (editAbonnement ? editAbonnement.priceId : newAbonnement.priceId)
      );
      const stayedPeriode = selectedPrice
        ? `${selectedPrice.name} (${selectedPrice.timePeriod.start} ${selectedPrice.timePeriod.end})`
        : "";

      if (editAbonnement) {
        await updateAbonnement({
          id: editAbonnement.id,
          data: {
            ...editAbonnement,
            stayedPeriode,
          },
        }).unwrap();
      } else {
        await createAbonnement({
          ...newAbonnement,
          stayedPeriode,
        }).unwrap();
      }

      handleCloseDrawer();
      refetch();
    } catch (error) {
      console.error("Error saving subscription:", error);
    }
  };
  const handleDelete = async () => {
    if (abonnementToDelete) {
      try {
        await deleteAbonnement(abonnementToDelete).unwrap();
        refetch();
      } catch (error) {
        console.error("Error deleting subscription:", error);
      } finally {
        setShowDeleteModal(false);
        setAbonnementToDelete(null);
      }
    }
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditAbonnement(null);
    setNewAbonnement({
      registredDate: new Date(),
      leaveDate: new Date(),
      payedAmount: 0,
      isPayed: false,
      isReservation: false,
    });
    setErrors({});
  };

  const handlePriceSelect = (price: Price) => {
    const registredDate =
      editAbonnement?.registredDate ||
      newAbonnement.registredDate ||
      new Date();
    let leaveDate = new Date(registredDate);

    // Calcul basé sur les dates du prix
    const start = parseInt(price.timePeriod.start, 10);
    const end = parseInt(price.timePeriod.end, 10);
    const durationDays = end - start;

    leaveDate.setDate(leaveDate.getDate() + durationDays);

    const update = {
      priceId: price.id,
      payedAmount: price.price,
      leaveDate: leaveDate,
    };

    if (editAbonnement) {
      setEditAbonnement({ ...editAbonnement, ...update });
    } else {
      setNewAbonnement({ ...newAbonnement, ...update });
    }
  };

  // Garder l'affichage du nom original
  const getDurationDescription = (price: Price) => {
    const start = parseInt(price.timePeriod.start, 10);
    const end = parseInt(price.timePeriod.end, 10);

    return `${price.name}`; // Affiche "1week (7 jours)"
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  if (isLoading) return <CircularProgress />;
  if (isError)
    return <Alert severity="error">Error loading subscriptions</Alert>;
  const handleNewMember = (member: Member) => {
    setMember(member);
    if (editAbonnement) {
      setEditAbonnement({ ...editAbonnement, memberID: member.id });
    } else {
      setNewAbonnement({ ...newAbonnement, memberID: member.id });
    }
  };
  const calculateRemainingTime = (leaveDate: Date | string | null) => {
    if (!leaveDate) return "N/A";

    try {
      const endDate = new Date(leaveDate);
      const now = new Date();

      // Si la date est déjà passée
      if (endDate < now) return "Expired";

      // Calcul de la différence en millisecondes
      const diffMs = endDate.getTime() - now.getTime();

      // Calcul des différentes unités de temps
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      // Formatage du résultat
      if (diffDays > 30) {
        const months = Math.floor(diffDays / 30);
        const remainingDays = diffDays % 30;
        return `${months} month(s) ${remainingDays} day(s)`;
      } else if (diffDays > 7) {
        const weeks = Math.floor(diffDays / 7);
        const remainingDays = diffDays % 7;
        return `${weeks} week(s) ${remainingDays} day(s)`;
      } else if (diffDays > 0) {
        return `${diffDays} day(s) ${diffHours} hour(s)`;
      } else {
        return `${diffHours} hour(s) ${diffMinutes} minute(s)`;
      }
    } catch (e) {
      return "Invalid date";
    }
  };

  const getRemainingTimeStyle = (
    leaveDate: Date | string | null,
    theme: any
  ) => {
    if (!leaveDate) return {};

    try {
      const endDate = new Date(leaveDate);
      const now = new Date();
      const diffDays = Math.floor(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays <= 0) {
        return { color: theme.palette.error.main, fontWeight: "bold" };
      } else if (diffDays <= 3) {
        return { color: theme.palette.warning.main, fontWeight: "bold" };
      }
      return { color: theme.palette.success.main };
    } catch (e) {
      return {};
    }
  };

  if (openUserForm)
    return (
      <UserForm
        handleClose={() => {
          setOpenUserForm(false);
        }}
        selectItem={null}
        handleNewMember={handleNewMember}
      />
    );
  return (
    <PageContainer>
      <MainContainer>
        <TableHeadAction
          handleClickOpen={() => setShowDrawer(true)}
          onHandleSearch={handleSearch}
          search={search}
          refetch={refetch}
          isMobile={isMobile}
        />
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            mb: 2,
            mt: -12,
            ml: 1,
          }}
        >
          <FormControl
            size="small"
            variant="outlined"
            sx={{
              minWidth: 100,
              backgroundColor: "#f5f5f5",
              borderRadius: 2,
              boxShadow: 1,
            }}
          >
            <InputLabel>Period</InputLabel>
            <Select
              value={timeFilter}
              onChange={(e) =>
                setTimeFilter(e.target.value as "week" | "month" | "all")
              }
              label="Period"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="week">Weekly</MenuItem>
              <MenuItem value="month">Monthly</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <TableWrapper>
          <StyledTableContainer>
            <Table stickyHeader aria-label="subscriptions table">
              <EnhancedTableHead
                numSelected={selected.length}
                order={order}
                orderBy={orderBy}
                onSelectAllClick={handleSelectAllClick}
                onRequestSort={handleRequestSort}
                rowCount={filteredData.length}
                headCells={headCells}
                isMobile={isMobile}
              />
              <TableBody>
                {filteredData.map((abonnement) => {
                  const member = members.find(
                    (m) => m.id === abonnement.memberID
                  );
                  const price = prices.find((p) => p.id === abonnement.priceId);
                  const leaveDate = abonnement.leaveDate
                    ? new Date(abonnement.leaveDate)
                    : null;
                  const today = new Date();
                  const shouldBlink = leaveDate && isSameDay(leaveDate, today);
                  const TableRowComponent = shouldBlink
                    ? BlinkingTableRow
                    : TableRow;
                  const isItemSelected = isSelected(abonnement.id);

                  return (
                    <TableRowComponent
                      key={abonnement.id}
                      hover
                      onClick={(event) => handleClick(event, abonnement.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      selected={isItemSelected}
                    >
                      <ResponsiveTableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          inputProps={{ "aria-labelledby": abonnement.id }}
                        />
                      </ResponsiveTableCell>
                      <ResponsiveTableCell>
                        {member
                          ? `${member.firstName} ${member.lastName}`
                          : "N/A"}
                      </ResponsiveTableCell>
                      <ResponsiveTableCell>
                        {formatDate(abonnement.registredDate)}
                      </ResponsiveTableCell>
                      <ResponsiveTableCell>
                        {formatDate(abonnement.leaveDate)}
                      </ResponsiveTableCell>
                      {!isMobile && (
                        <>
                          <ResponsiveTableCell>
                            {price?.name}
                          </ResponsiveTableCell>
                          {abonnement.leaveDate && (
                            <ResponsiveTableCell
                              sx={getRemainingTimeStyle(
                                abonnement.leaveDate,
                                theme
                              )}
                            >
                              {calculateRemainingTime(abonnement.leaveDate)}
                            </ResponsiveTableCell>
                          )}
                          <ResponsiveTableCell>
                            {abonnement.payedAmount} DT
                          </ResponsiveTableCell>
                          <ResponsiveTableCell>
                            <Box
                              sx={{
                                color: abonnement.isPayed
                                  ? "success.main"
                                  : "error.main",
                                fontWeight: "bold",
                              }}
                            >
                              {abonnement.isPayed ? "Paid" : "Unpaid"}
                            </Box>
                          </ResponsiveTableCell>
                        </>
                      )}
                      <ResponsiveTableCell
                        align={isMobile ? "right" : "center"}
                      >
                        <ResponsiveActions>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditAbonnement({
                                ...abonnement,
                                leaveDate: abonnement.leaveDate
                                  ? new Date(abonnement.leaveDate)
                                  : new Date(),
                              });
                              setShowDrawer(true);
                            }}
                            size={isMobile ? "small" : "medium"}
                          >
                            <EditIcon color="primary" />
                          </IconButton>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setAbonnementToDelete(abonnement.id);
                              setShowDeleteModal(true);
                            }}
                            size={isMobile ? "small" : "medium"}
                          >
                            <DeleteIcon color="error" />
                          </IconButton>
                        </ResponsiveActions>
                      </ResponsiveTableCell>
                    </TableRowComponent>
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
        <DialogTitle>Delete Subscription</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this subscription? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" autoFocus>
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
          {editAbonnement ? "Manage Subscription" : "New Subscription"}
        </Typography>

        <Box sx={{ mb: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          {!editAbonnement && (
            <ActionButton
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={() => setOpenMemberModal(true)}
              sx={{
                height: "56px",
                width: "200px", // Largeur fixe pour le bouton
                alignSelf: "flex-start", // Alignement à gauche
              }}
            >
              New Member
            </ActionButton>
          )}

          {/* Sélecteur de membre avec largeur réduite */}
          <FormControl
            sx={{
              width: "100%",
              maxWidth: "400", // Largeur maximale réduite
              "& .MuiInputBase-root": {
                height: "50px",
              },
            }}
            error={!!errors.memberID}
          >
            <InputLabel>Member *</InputLabel>
            <Select
              value={editAbonnement?.memberID || newAbonnement.memberID || ""}
              onChange={(e) => {
                const value = e.target.value as string;
                if (editAbonnement) {
                  setEditAbonnement({ ...editAbonnement, memberID: value });
                } else {
                  setNewAbonnement({ ...newAbonnement, memberID: value });
                }
              }}
              label="Member *"
              disabled={!!editAbonnement}
            >
              <MenuItem value="">Select a member</MenuItem>
              {membersWithSubscriptionStatus.map((member) => (
                <MenuItem
                  key={member.id}
                  value={member.id}
                  disabled={member.hasSubscription && !editAbonnement}
                  sx={{
                    opacity:
                      member.hasSubscription && !editAbonnement ? 0.7 : 1,
                    fontStyle:
                      member.hasSubscription && !editAbonnement
                        ? "italic"
                        : "normal",
                    py: 2,
                  }}
                >
                  {member.firstName} {member.lastName} ({member.plan})
                  {member.hasSubscription &&
                    !editAbonnement &&
                    " (Already subscribed)"}
                </MenuItem>
              ))}
            </Select>
            {errors.memberID && (
              <FormHelperText>{errors.memberID}</FormHelperText>
            )}
          </FormControl>
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 0 }}>
          Select Rate *
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {abonnementPrices.map((price) => (
            <Grid item xs={12} sm={6} key={price.id}>
              {/* Voici le PriceCard */}
              <PriceCard
                sx={{
                  border:
                    (editAbonnement?.priceId || newAbonnement.priceId) ===
                      price.id
                      ? "2px solid #054547"
                      : "1px solid #ddd",
                  backgroundColor:
                    (editAbonnement?.priceId || newAbonnement.priceId) ===
                      price.id
                      ? "#f5f9f9"
                      : "#fff",
                }}
                onClick={() => handlePriceSelect(price)}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    <Box component="span" sx={{ fontWeight: "bold" }}>
                      {getDurationDescription(price)}
                    </Box>
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {price.price} DT
                  </Typography>
                </CardContent>
              </PriceCard>
            </Grid>
          ))}
        </Grid>
        {errors.priceId && (
          <FormHelperText error sx={{ mb: 0 }}>
            {errors.priceId}
          </FormHelperText>
        )}

        <DatePicker
          label="Registration Date *"
          value={
            editAbonnement?.registredDate
              ? new Date(editAbonnement.registredDate)
              : newAbonnement.registredDate
          }
          onChange={(date) => {
            const newDate = date || new Date();
            if (editAbonnement) {
              setEditAbonnement({ ...editAbonnement, registredDate: newDate });
            } else {
              setNewAbonnement({ ...newAbonnement, registredDate: newDate });
            }
          }}
          sx={{ width: "100%", mb: 0 }}
        />
        {errors.registredDate && (
          <FormHelperText error sx={{ mb: 0 }}>
            {errors.registredDate}
          </FormHelperText>
        )}

        <DatePicker
          label="Leave Date *"
          value={editAbonnement?.leaveDate || newAbonnement.leaveDate}
          onChange={(date) => {
            const newDate = date || new Date();
            if (editAbonnement) {
              setEditAbonnement({ ...editAbonnement, leaveDate: newDate });
            } else {
              setNewAbonnement({ ...newAbonnement, leaveDate: newDate });
            }
          }}
          sx={{ width: "100%", mb: 0 }}
        />
        {errors.leaveDate && (
          <FormHelperText error sx={{ mb: 0 }}>
            {errors.leaveDate}
          </FormHelperText>
        )}

        <TextField
          label="Paid Amount (DT)"
          type="number"
          fullWidth
          value={editAbonnement?.payedAmount || newAbonnement.payedAmount || 0}
          onChange={(e) => {
            const value = Math.max(0, Number(e.target.value));
            if (editAbonnement) {
              setEditAbonnement({ ...editAbonnement, payedAmount: value });
            } else {
              setNewAbonnement({ ...newAbonnement, payedAmount: value });
            }
          }}
          sx={{ mb: 0 }}
        />

        <FormControl fullWidth sx={{ mb: 0 }}>
          <InputLabel>Payment Status</InputLabel>
          <Select
            value={
              editAbonnement?.isPayed ?? newAbonnement.isPayed
                ? "true"
                : "false"
            }
            onChange={(e) => {
              const value = e.target.value === "true";
              if (editAbonnement) {
                setEditAbonnement({ ...editAbonnement, isPayed: value });
              } else {
                setNewAbonnement({ ...newAbonnement, isPayed: value });
              }
            }}
            label="Payment Status"
          >
            <MenuItem value="true">Paid</MenuItem>
            <MenuItem value="false">Unpaid</MenuItem>
          </Select>
        </FormControl>

        <Divider />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 2,
          }}
        >
          <Typography variant="h6">Total</Typography>
          <Typography variant="h6" fontWeight="bold">
            {editAbonnement?.payedAmount || newAbonnement.payedAmount || 0} DT
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: "10px",
            mt: "auto",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <ActionButton variant="outlined" onClick={handleCloseDrawer}>
            Cancel
          </ActionButton>
          <SubmitButton variant="contained" onClick={handleSubmit}>
            {editAbonnement ? "Confirm" : "Confirm"}
          </SubmitButton>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={openMemberModal}
        onClose={() => setOpenMemberModal(false)}
        PaperProps={{
          sx: {
            width: isMobile ? "100%" : "450px",
            padding: isMobile ? theme.spacing(2) : theme.spacing(3),
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          },
        }}
        ModalProps={{
          hideBackdrop: true,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            textAlign: "left",
            fontWeight: "bold",
            color: "gris",
          }}
        >
          Manage Member
        </Typography>

        <Divider
          sx={{
            backgroundColor: theme.palette.grey[300],
            my: 1,
          }}
        />

        <UserForm
          handleClose={() => setOpenMemberModal(false)}
          selectItem={null}
          handleNewMember={handleNewMember}
          defaultPlan={Subscription.Membership}
        />
      </Drawer>
    </PageContainer>
  );
};
AbonnementComponent.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      {" "}
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default AbonnementComponent;
