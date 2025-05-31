import React, { ReactElement, useState, useEffect } from "react";
import { useTheme } from "@mui/material/styles";
import { PersonAdd } from "@mui/icons-material";
import DashboardLayout from "../../layouts/Dashboard";
import Fuse from "fuse.js";
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
  Autocomplete,
  TablePagination,
  Snackbar,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DateTimePicker } from "@mui/x-date-pickers";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import TableHeadAction from "../../components/Table/members/TableHeader";
import UserForm from "src/components/pages/dashboard/members/UserForm";
import { HeadCell } from "src/types/table";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import { bookingService } from "src/api/bookingservice"; // Supposons que ceci est utilisé pour le ping

// Cache utilities
const setCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Error setting cache:", error);
  }
};

const getCache = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error getting cache:", error);
    return null;
  }
};

// Queue utilities
interface OfflineAction {
  type: "create" | "update" | "delete";
  payload: any;
  id?: string;
  timestamp: number;
}

const addToQueue = (action: OfflineAction) => {
  try {
    const queue: OfflineAction[] = getCache("offlineQueue") || [];
    queue.push(action);
    setCache("offlineQueue", queue);
  } catch (error) {
    console.error("Error adding to queue:", error);
  }
};

const getQueue = (): OfflineAction[] => {
  return getCache("offlineQueue") || [];
};

const clearQueue = () => {
  setCache("offlineQueue", []);
};

// Fonctions de tri
function getComparator(
  order: "asc" | "desc",
  orderBy: string
): (a: any, b: any) => number {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function descendingComparator(a: any, b: any, orderBy: string) {
  const getNestedValue = (obj: any, path: string) => {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  };

  const valueA = getNestedValue(a, orderBy) ?? "";
  const valueB = getNestedValue(b, orderBy) ?? "";

  if (orderBy === "member") {
    const nameA = a.member ? `${a.member.firstName} ${a.member.lastName}` : "";
    const nameB = b.member ? `${b.member.firstName} ${b.member.lastName}` : "";
    return nameA.localeCompare(nameB);
  }

  if (orderBy === "registredDate" || orderBy === "leaveDate") {
    const dateA = valueA ? new Date(valueA) : new Date(0);
    const dateB = valueB ? new Date(valueB) : new Date(0);
    return dateA.getTime() - dateB.getTime();
  }

  if (typeof valueA === "string" && typeof valueB === "string") {
    return valueA.localeCompare(valueB);
  }

  if (valueA < valueB) return -1;
  if (valueA > valueB) return 1;
  return 0;
}

function stableSort<T>(array: T[], comparator: (a: T, b: T) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

// Styles
const StatsCard = styled(Card)(({ theme }) => ({
  height: "100%",
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[2],
  transition: "transform 0.3s, box-shadow 0.3s",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: theme.shadows[6],
  },
}));

const StatsCardContent = styled(CardContent)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(3),
  "&:last-child": {
    paddingBottom: theme.spacing(3),
  },
}));

const StatsCount = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginTop: theme.spacing(1),
  color: theme.palette.text.primary,
  "& span": {
    display: "block",
    lineHeight: 1.5,
  },
}));

const StatsIconWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: theme.spacing(2),
}));

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

const StyledTablePagination = styled(TablePagination)(({ theme }) => ({
  "& .MuiTablePagination-root": {
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1),
  },
  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
    color: theme.palette.text.primary,
    fontWeight: 500,
  },
  "& .MuiTablePagination-actions": {
    "& .MuiIconButton-root": {
      color: theme.palette.primary.main,
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&.Mui-disabled": {
        color: theme.palette.action.disabled,
      },
    },
  },
  "& .MuiTablePagination-select": {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(0.5, 1),
  },
  [theme.breakpoints.down("sm")]: {
    "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
      fontSize: "0.875rem",
    },
    "& .MuiTablePagination-actions": {
      marginLeft: theme.spacing(1),
    },
  },
}));

interface AbonnementFormData extends Partial<Abonnement> {
  registredDate: Date;
  leaveDate: Date;
  payedAmount: number;
}

interface AbonnementProps {
  selectedDate: Date;
}

// Hooks personnalisés
const useCachedAbonnementsQuery = (params: any) => {
  const result = useGetAbonnementsQuery(params);
  useEffect(() => {
    if (result.data) {
      setCache("abonnements", result.data);
    }
  }, [result.data]);
  return {
    ...result,
    data: result.data || getCache("abonnements") || { data: [] },
  };
};

const useCachedMembersQuery = () => {
  const result = useGetMembersQuery();
  useEffect(() => {
    if (result.data) {
      setCache("members", result.data);
    }
  }, [result.data]);
  return {
    ...result,
    data: result.data || getCache("members") || [],
  };
};

const useCachedPricesQuery = () => {
  const result = useGetPricesQuery();
  useEffect(() => {
    if (result.data) {
      setCache("prices", result.data);
    }
  }, [result.data]);
  return {
    ...result,
    data: result.data || getCache("prices") || [],
  };
};

const AbonnementComponent = ({ selectedDate }: AbonnementProps) => {
  const theme = useTheme();
  const [timeFilter, setTimeFilter] = useState<"week" | "month" | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "expired" | "all">("all");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [orderBy, setOrderBy] = useState<string>("registredDate");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const fuseOptions = {
    keys: ["firstName", "lastName"],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  };

  const abonnementSearchOptions = {
    keys: ["member.firstName", "member.lastName", "price.name", "id", "stayedPeriode"],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  };

  const {
    data: abonnementsData,
    isLoading,
    isError,
    refetch,
  } = useCachedAbonnementsQuery({});
  const { data: members = [] } = useCachedMembersQuery();
  const { data: prices = [] } = useCachedPricesQuery();
  const abonnementPrices = prices.filter((price: Price) => price.type === "abonnement");

  const [openUserForm, setOpenUserForm] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [createAbonnement] = useCreateAbonnementMutation();
  const [updateAbonnement] = useUpdateAbonnementMutation();
  const [deleteAbonnement] = useDeleteAbonnementMutation();
  const {
    data: membersList,
    isLoading: isLoadingMember,
    error: membersError,
  } = useCachedMembersQuery();

  const [newAbonnement, setNewAbonnement] = useState<AbonnementFormData>({
    registredDate: selectedDate,
    leaveDate: selectedDate,
    payedAmount: 0,
    isPayed: false,
    isReservation: false,
    stayedPeriode: "",
  });

  const [editAbonnement, setEditAbonnement] = useState<Abonnement | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [abonnementToDelete, setAbonnementToDelete] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openMemberModal, setOpenMemberModal] = useState(false);

  // Vérification périodique de la connectivité
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Effectuer une requête de test vers le backend
        await bookingService.getAllBookings(); // Remplacez par une API légère de votre backend
        if (!isOnline) {
          setIsOnline(true);
          setSuccessMessage("Connection restored!");
        }
      } catch (error) {
        if (isOnline) {
          setIsOnline(false);
          setErrorMessage("Connection lost. Working offline.");
        }
      }
    };

    // Vérifier immédiatement et ensuite toutes les 30 secondes
    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      const syncQueue = async () => {
        const queue = getQueue();
        if (queue.length === 0) return;

        let syncedActions = 0;
        let failedActions = 0;

        try {
          for (const action of queue) {
            try {
              if (action.type === "create") {
                await createAbonnement(action.payload).unwrap();
                syncedActions++;
              } else if (action.type === "update" && action.id) {
                await updateAbonnement({ id: action.id, data: action.payload }).unwrap();
                syncedActions++;
              } else if (action.type === "delete" && action.id) {
                await deleteAbonnement(action.id).unwrap();
                syncedActions++;
              }
            } catch (error) {
              failedActions++;
              console.error(`Failed to sync ${action.type} action:`, error);
            }
          }
          clearQueue();
          if (syncedActions > 0) {
            setSuccessMessage(
              `${syncedActions} offline action${syncedActions > 1 ? 's' : ''} synced successfully!`
            );
          }
          if (failedActions > 0) {
            setErrorMessage(
              `${failedActions} action${failedActions > 1 ? 's' : ''} failed to sync.`
            );
          }
          refetch();
        } catch (error: any) {
          setErrorMessage("Error syncing offline actions: " + error.message);
        }
      };
      syncQueue();
    }
  }, [isOnline, refetch, createAbonnement, updateAbonnement, deleteAbonnement]);

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const { expiredMembers, soonToExpireMembers, activeMembers } = React.useMemo(() => {
    const today = new Date(selectedDate);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const expired: string[] = [];
    const soonToExpire: string[] = [];
    const active: string[] = [];

    abonnementsData?.data.forEach((abonnement: Abonnement) => {
      const member = members.find((m: any) => m.id === abonnement.memberID);
      if (!member || !abonnement.leaveDate) return;

      const memberName = `${member.firstName} ${member.lastName}`;
      const leaveDate = new Date(abonnement.leaveDate);

      if (isSameDay(leaveDate, today)) {
        if (!expired.includes(memberName)) expired.push(memberName);
      } else if (isSameDay(leaveDate, tomorrow)) {
        if (!soonToExpire.includes(memberName)) soonToExpire.push(memberName);
      } else if (
        abonnement.registredDate &&
        isSameDay(new Date(abonnement.registredDate), today)
      ) {
        if (!active.includes(memberName)) active.push(memberName);
      }
    });

    return {
      expiredMembers: expired,
      soonToExpireMembers: soonToExpire,
      activeMembers: active,
    };
  }, [abonnementsData, members, selectedDate]);

  const filteredData = React.useMemo(() => {
    if (!abonnementsData?.data) return [];
    const enrichedData = abonnementsData.data.map((abonnement: any) => ({
      ...abonnement,
      member: members.find((m: any) => m.id === abonnement.memberID),
      price: prices.find((p: any) => p.id === abonnement.priceId),
    }));

    let filtered = enrichedData;

    if (search && search.length >= 2) {
      const fuse = new Fuse(enrichedData, abonnementSearchOptions);
      const results = fuse.search(search);
      filtered = results.map((result: any) => result.item);
    }

    filtered = filtered.filter((abonnement: any) => {
      if (!abonnement.registredDate || !abonnement.leaveDate) return false;
      const startDate = new Date(abonnement.registredDate);
      const endDate = new Date(abonnement.leaveDate);
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      switch (timeFilter) {
        case "week":
          return diffDays >= 7 && diffDays <= 21;
        case "month":
          return diffDays >= 28;
        case "all":
        default:
          return true;
      }
    });

    filtered = filtered.filter((abonnement: any) => {
      if (!abonnement.leaveDate) return true;
      const leaveDate = new Date(abonnement.leaveDate);
      const now = new Date();
      switch (statusFilter) {
        case "active":
          return leaveDate >= now;
        case "expired":
          return leaveDate < now;
        case "all":
        default:
          return true;
      }
    });

    return stableSort(filtered, getComparator(order, orderBy));
  }, [abonnementsData?.data, timeFilter, statusFilter, prices, search, members, order, orderBy]);

  const paginatedData = React.useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

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
      id: "stayedPeriode",
      numeric: false,
      disablePadding: false,
      label: "Stayed Period",
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

  const membersWithSubscriptionStatus = members.map((member: any) => {
    const memberAbonnements =
      abonnementsData?.data.filter((abonnement: any) => abonnement.memberID === member.id) || [];
    const hasActiveSubscription = memberAbonnements.some((abonnement: any) => {
      if (!abonnement.leaveDate) return false;
      return new Date(abonnement.leaveDate) >= new Date();
    });
    const hasExpiredSubscription = memberAbonnements.some((abonnement: any) => {
      if (!abonnement.leaveDate) return false;
      return new Date(abonnement.leaveDate) < new Date();
    });
    return {
      ...member,
      hasActiveSubscription,
      hasExpiredSubscription,
      hasAnySubscription: memberAbonnements.length > 0,
    };
  });

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleString();
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
    setPage(0);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = paginatedData.map((n: any) => n.id);
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
    setPage(0);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (
      !(editAbonnement
        ? editAbonnement.registredDate
        : newAbonnement.registredDate)
    ) {
      newErrors.registredDate = "Registration date and time is required";
    }
    const leaveDate = editAbonnement
      ? editAbonnement.leaveDate
      : newAbonnement.leaveDate;
    if (!leaveDate) {
      newErrors.leaveDate = "Leave date and time is required";
    } else if (
      new Date(leaveDate) <=
      new Date(
        editAbonnement?.registredDate ||
        newAbonnement.registredDate ||
        new Date()
      )
    ) {
      newErrors.leaveDate =
        "Leave date and time must be after registration date and time";
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

    const selectedPrice = prices.find(
      (p: Price) => p.id === (editAbonnement ? editAbonnement.priceId : newAbonnement.priceId)
    );
    const stayedPeriode = selectedPrice
      ? `${selectedPrice.name} (${selectedPrice.timePeriod.start} ${selectedPrice.timePeriod.end})`
      : "";

    const abonnementData = {
      ...(editAbonnement || newAbonnement),
      stayedPeriode,
      registredDate: new Date(editAbonnement?.registredDate || newAbonnement.registredDate),
      leaveDate: new Date(editAbonnement?.leaveDate || newAbonnement.leaveDate),
    };

    if (!isOnline) {
      const action: OfflineAction = {
        type: editAbonnement ? "update" : "create",
        payload: abonnementData,
        id: editAbonnement?.id,
        timestamp: Date.now(),
      };
      addToQueue(action);

      const currentAbonnements = getCache("abonnements") || { data: [] };
      let updatedAbonnements;
      if (editAbonnement) {
        updatedAbonnements = {
          data: currentAbonnements.data.map((a: Abonnement) =>
            a.id === editAbonnement.id ? abonnementData : a
          ),
        };
      } else {
        abonnementData.id = `offline-${Date.now()}`;
        updatedAbonnements = {
          data: [...currentAbonnements.data, abonnementData],
        };
      }
      setCache("abonnements", updatedAbonnements);

      handleCloseDrawer();
      setSuccessMessage("Action queued for sync!");
      return;
    }

    try {
      if (editAbonnement) {
        await updateAbonnement({
          id: editAbonnement.id,
          data: abonnementData,
        }).unwrap();
        setSuccessMessage("Subscription updated successfully!");
      } else {
        await createAbonnement(abonnementData).unwrap();
        setSuccessMessage("Subscription created successfully!");
      }
      handleCloseDrawer();
      refetch();
    } catch (error) {
      console.error("Error saving subscription:", error);
      setErrorMessage("Failed to save subscription.");
    }
  };

  const handleDelete = async () => {
    if (!abonnementToDelete) return;

    if (!isOnline) {
      const action: OfflineAction = {
        type: "delete",
        id: abonnementToDelete,
        payload: null,
        timestamp: Date.now(),
      };
      addToQueue(action);

      const currentAbonnements = getCache("abonnements") || { data: [] };
      const updatedAbonnements = {
        data: currentAbonnements.data.filter((a: Abonnement) => a.id !== abonnementToDelete),
      };
      setCache("abonnements", updatedAbonnements);

      setSuccessMessage("Deletion queued for sync!");
      setShowDeleteModal(false);
      setAbonnementToDelete(null);
      if (paginatedData.length === 1 && page > 0) {
        setPage(page - 1);
      }
      return;
    }

    try {
      await deleteAbonnement(abonnementToDelete).unwrap();
      refetch();
      setSuccessMessage("Subscription deleted successfully!");
      if (paginatedData.length === 1 && page > 0) {
        setPage(page - 1);
      }
    } catch (error) {
      console.error("Error deleting subscription:", error);
      setErrorMessage("Failed to delete subscription.");
    } finally {
      setShowDeleteModal(false);
      setAbonnementToDelete(null);
    }
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditAbonnement(null);
    setNewAbonnement({
      registredDate: selectedDate,
      leaveDate: selectedDate,
      payedAmount: 0,
      isPayed: false,
      isReservation: false,
      stayedPeriode: "",
    });
    setErrors({});
  };

  const handlePriceSelect = (price: Price) => {
    const registredDate =
      editAbonnement?.registredDate ||
      newAbonnement.registredDate ||
      selectedDate;
    let leaveDate = new Date(registredDate);
    const start = parseInt(price.timePeriod.start, 10);
    const end = parseInt(price.timePeriod.end, 10);
    const durationDays = end - start;
    leaveDate.setDate(leaveDate.getDate() + durationDays);

    const currentLeaveDate =
      editAbonnement?.leaveDate || newAbonnement.leaveDate;
    if (currentLeaveDate) {
      const existingTime = new Date(currentLeaveDate);
      leaveDate.setHours(existingTime.getHours(), existingTime.getMinutes());
    }

    const update = {
      priceId: price.id,
      payedAmount: price.price,
      leaveDate: leaveDate,
      registredDate: registredDate,
    };
    if (editAbonnement) {
      setEditAbonnement({ ...editAbonnement, ...update });
    } else {
      setNewAbonnement({ ...newAbonnement, ...update });
    }
  };

  const getDurationDescription = (price: Price) => {
    const start = parseInt(price.timePeriod.start, 10);
    const end = parseInt(price.timePeriod.end, 10);
    return `${price.name}`;
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

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
      if (endDate < now) return "Expired";
      const diffMs = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (diffDays >= 30) {
        const months = Math.floor(diffDays / 30);
        const remainingDays = diffDays % 30;
        if (remainingDays === 0) {
          return `${months} month(s)`;
        } else {
          return `${months} month(s) ${remainingDays} day(s)`;
        }
      } else if (diffDays >= 7) {
        const weeks = Math.floor(diffDays / 7);
        const remainingDays = diffDays % 7;
        if (remainingDays === 0) {
          return `${weeks} week(s)`;
        } else {
          return `${weeks} week(s) ${remainingDays} day(s)`;
        }
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

  const handleRegistrationDateChange = (date: Date | null) => {
    const newDate = date || selectedDate;
    let newLeaveDate: Date;

    const currentPriceId = editAbonnement?.priceId || newAbonnement.priceId;
    const selectedPrice = prices.find((p: Price) => p.id === currentPriceId);

    if (selectedPrice) {
      const start = parseInt(selectedPrice.timePeriod.start, 10);
      const end = parseInt(selectedPrice.timePeriod.end, 10);
      const durationDays = end - start;

      newLeaveDate = new Date(newDate);
      newLeaveDate.setDate(newDate.getDate() + durationDays);

      const currentLeaveDate =
        editAbonnement?.leaveDate || newAbonnement.leaveDate;
      if (currentLeaveDate) {
        const existingTime = new Date(currentLeaveDate);
        newLeaveDate.setHours(
          existingTime.getHours(),
          existingTime.getMinutes()
        );
      }
    } else {
      newLeaveDate = new Date(
        editAbonnement?.leaveDate || newAbonnement.leaveDate || newDate
      );
      newLeaveDate.setHours(newDate.getHours(), newDate.getMinutes());
    }

    if (editAbonnement) {
      setEditAbonnement({
        ...editAbonnement,
        registredDate: newDate,
        leaveDate: newLeaveDate,
      });
    } else {
      setNewAbonnement({
        ...newAbonnement,
        registredDate: newDate,
        leaveDate: newLeaveDate,
      });
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (isLoading) return <CircularProgress />;
  if (isError && !abonnementsData?.data)
    return <Alert severity="error">Error loading subscriptions</Alert>;
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
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <StatsCard
            sx={{ borderTop: `4px solid ${theme.palette.error.main}` }}
          >
            <StatsCardContent>
              <Box>
                <Typography variant="subtitle1" color="textSecondary">
                  Expired Today
                </Typography>
                <StatsCount variant="h5">
                  {expiredMembers.length > 0
                    ? expiredMembers.map((member, index) => (
                        <span key={index}>{member}</span>
                      ))
                    : "None"}
                </StatsCount>
              </Box>
              <ErrorIcon
                fontSize="medium"
                sx={{
                  color: theme.palette.error.main,
                  ml: 2,
                }}
              />
            </StatsCardContent>
          </StatsCard>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatsCard
            sx={{ borderTop: `4px solid ${theme.palette.warning.main}` }}
          >
            <StatsCardContent>
              <Box>
                <Typography variant="subtitle1" color="textSecondary">
                  Expiring Tomorrow
                </Typography>
                <StatsCount variant="h5">
                  {soonToExpireMembers.length > 0
                    ? soonToExpireMembers.map((member, index) => (
                        <span key={index}>{member}</span>
                      ))
                    : "None"}
                </StatsCount>
              </Box>
              <StatsIconWrapper>
                <WarningIcon
                  fontSize="medium"
                  sx={{ color: theme.palette.warning.main }}
                />
              </StatsIconWrapper>
            </StatsCardContent>
          </StatsCard>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatsCard
            sx={{ borderTop: `4px solid ${theme.palette.success.main}` }}
          >
            <StatsCardContent>
              <Box>
                <Typography variant="subtitle1" color="textSecondary">
                  Subscribed Today
                </Typography>
                <StatsCount variant="h5">
                  {activeMembers.length > 0
                    ? activeMembers.map((member, index) => (
                        <span key={index}>{member}</span>
                      ))
                    : "None"}
                </StatsCount>
              </Box>
              <CheckCircleIcon
                fontSize="medium"
                sx={{
                  color: theme.palette.success.main,
                  ml: 2,
                }}
              />
            </StatsCardContent>
          </StatsCard>
        </Grid>
      </Grid>

      <MainContainer>
        <TableHeadAction
          handleClickOpen={() => setShowDrawer(true)}
          onHandleSearch={handleSearch}
          search={search}
          refetch={refetch}
          isMobile={isMobile}
          handleDailyExpenseClick={function (): void {
            throw new Error("Function not implemented.");
          }}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 2,
            mb: 2,
            mt: isMobile ? 0 : 2,
            alignItems: isMobile ? "stretch" : "flex-start",
          }}
        >
          <FormControl
            size="small"
            variant="outlined"
            sx={{
              width: isMobile ? "100%" : 150,
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

          <FormControl
            size="small"
            variant="outlined"
            sx={{
              width: isMobile ? "100%" : 150,
              backgroundColor: "#f5f5f5",
              borderRadius: 2,
              boxShadow: 1,
            }}
          >
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "active" | "expired" | "all")
              }
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
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
                rowCount={paginatedData.length}
                headCells={headCells}
                isMobile={isMobile}
              />
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headCells.length} align="center">
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((abonnement: any) => {
                    const member = members.find(
                      (m: any) => m.id === abonnement.memberID
                    );
                    const price = prices.find(
                      (p: any) => p.id === abonnement.priceId
                    );
                    const leaveDate = abonnement.leaveDate
                      ? new Date(abonnement.leaveDate)
                      : null;
                    const today = new Date();
                    const shouldBlink =
                      leaveDate && isSameDay(leaveDate, today);
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
                                const abonnementToEdit = {
                                  ...abonnement,
                                  leaveDate: abonnement.leaveDate
                                    ? new Date(abonnement.leaveDate)
                                    : new Date(),
                                  registredDate: abonnement.registredDate
                                    ? new Date(abonnement.registredDate)
                                    : new Date(),
                                  member: undefined,
                                  price: undefined,
                                };
                                setEditAbonnement(abonnementToEdit);
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
                  })
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
          <StyledTablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            count={filteredData.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage={isMobile ? "Rows:" : "Rows per page:"}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
            }
          />
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
                width: "200px",
                alignSelf: "flex-start",
              }}
            >
              New Member
            </ActionButton>
          )}
          <Autocomplete
            options={membersWithSubscriptionStatus}
            getOptionLabel={(option) =>
              `${option.firstName} ${option.lastName} (${option.plan})`
            }
            value={
              membersWithSubscriptionStatus.find(
                (m: any) =>
                  m.id === (editAbonnement?.memberID || newAbonnement.memberID)
              ) || null
            }
            onChange={(event, newValue) => {
              const value = newValue ? newValue.id : "";
              if (editAbonnement) {
                setEditAbonnement({ ...editAbonnement, memberID: value });
              } else {
                setNewAbonnement({ ...newAbonnement, memberID: value });
              }
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue || inputValue.length < 2) {
                return options;
              }
              const fuse = new Fuse(options, fuseOptions);
              const results = fuse.search(inputValue);
              return results.map((result: any) => result.item);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Member *"
                error={!!errors.memberID}
                helperText={
                  errors.memberID || "Type at least 2 characters to search"
                }
              />
            )}
            disabled={!!editAbonnement}
            getOptionDisabled={(option) => {
              if (editAbonnement) return false;
              return option.hasActiveSubscription;
            }}
            sx={{
              width: "100%",
              maxWidth: "400px",
              "& .MuiInputBase-root": { height: "50px" },
            }}
          />
        </Box>
        <Typography variant="subtitle1" sx={{ mb: 0 }}>
          Select Rate *
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {abonnementPrices.map((price: any) => (
            <Grid item xs={12} sm={6} key={price.id}>
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
                    <Box component="span" sx={{ fontWeight: "blank" }}>
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
        <DateTimePicker
          label="Registration Date and Time *"
          value={
            editAbonnement?.registredDate
              ? new Date(editAbonnement.registredDate)
              : newAbonnement.registredDate
          }
          onChange={handleRegistrationDateChange}
          sx={{ width: "100%", mb: 0 }}
        />
        {errors.registredDate && (
          <FormHelperText error sx={{ mb: 0 }}>
            {errors.registredDate}
          </FormHelperText>
        )}
        <DateTimePicker
          label="Leave Date and Time *"
          value={editAbonnement?.leaveDate || newAbonnement.leaveDate}
          onChange={(date) => {
            const newDate = date || selectedDate;
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
        ModalProps={{ hideBackdrop: true }}
      >
        <Typography
          variant="h6"
          sx={{ textAlign: "left", fontWeight: "bold", color: "grey" }}
        >
          Manage Member
        </Typography>
        <Divider sx={{ backgroundColor: theme.palette.grey[300], my: 1 }} />
        <UserForm
          handleClose={() => setOpenMemberModal(false)}
          selectItem={null}
          handleNewMember={handleNewMember}
          defaultPlan={Subscription.Membership}
        />
      </Drawer>
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!isOnline}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning">
          You are offline. Actions will be synced when connection is restored.
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

AbonnementComponent.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default AbonnementComponent;