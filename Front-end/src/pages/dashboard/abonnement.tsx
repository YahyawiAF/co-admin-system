import React, { useState } from "react";
import { useTheme } from '@mui/material/styles';
import { PersonAdd } from "@mui/icons-material";

import {
  useGetAbonnementsQuery,
  useCreateAbonnementMutation,
  useUpdateAbonnementMutation,
  useDeleteAbonnementMutation,
} from "src/api/abonnement.repo";
import { useGetMembersQuery } from "src/api/members.repo";
import { useGetPricesQuery } from "src/api/price.repo";
import { Abonnement, Member, Price } from "src/types/shared";
import {
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
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
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DatePicker } from "@mui/x-date-pickers";
import DashboardLayout from "../../layouts/Dashboard";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import EnhancedTableHead from "src/components/Table/EnhancedTableHead";
import TableHeadAction from "../../components/Table/members/TableHeader";



import UserForm from "src/components/pages/dashboard/members/UserForm";
import { HeadCell } from "src/types/table";

// Styles responsives
const PageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 'calc(100vh - 64px)',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
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
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
}));

const TableWrapper = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.up('sm')]: {
    marginTop: theme.spacing(3),
  },
}));

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  '& .MuiTable-root': {
    minWidth: 650,
    [theme.breakpoints.down('sm')]: {
      minWidth: '100%',
    },
  },
  '& .MuiTableRow-root': {
    backgroundColor: theme.palette.background.paper,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  '& .MuiTableCell-root': {
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(1.5),
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(2),
    },
  },
}));

const ResponsiveTableCell = styled(TableCell)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    '&:nth-of-type(1)': { width: '30%' },
    '&:nth-of-type(2)': { width: '20%' },
    '&:nth-of-type(3)': { width: '20%' },
    '&:nth-of-type(4)': { display: 'none' },
    '&:nth-of-type(5)': { display: 'none' },
    '&:nth-of-type(6)': { display: 'none' },
    '&:nth-of-type(7)': { width: '30%' },
  },
}));


const ResponsiveActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.up('sm')]: {
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
  [theme.breakpoints.up('sm')]: {
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
  [theme.breakpoints.up('sm')]: {
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
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const PriceCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
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

  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string>('registredDate');
  const [selected, setSelected] = useState<string[]>([]);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  
  const { 
    data: abonnementsData, 
    isLoading, 
    isError, 
    refetch 
  } = useGetAbonnementsQuery({
    search: search,
  });

  const { data: members = [] } = useGetMembersQuery();
  const { data: prices = [] } = useGetPricesQuery();
  const abonnementPrices = prices.filter(price => price.type === "abonnement");
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
  const [editAbonnement, setEditAbonnement] = useState<Abonnement | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [abonnementToDelete, setAbonnementToDelete] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openMemberModal, setOpenMemberModal] = useState(false);
  const headCells: Array<HeadCell> = [
    {
      id: 'member',
      numeric: false,
      disablePadding: true,
      label: 'Member',
     
    },
    {
      id: 'registredDate',
      numeric: false,
      disablePadding: false,
      label: 'Registered Date',
      
    },
    {
      id: 'leaveDate',
      numeric: false,
      disablePadding: false,
      label: 'Leave Date',
     
    },
    {
      id: 'Stayed Periode',
      numeric: false,
      disablePadding: false,
      label: 'Stayed Periode',
      
    },
    {
      id: 'payedAmount',
      numeric: false,
      disablePadding: false,
      label: 'Paid Amount',
     
    },
    {
      id: 'status',
      numeric: false,
      disablePadding: false,
      label: 'Status',
      
    },
    {
      id: 'actions',
      numeric: false,
      disablePadding: false,
      label: 'Actions',
      alignment: "right",
    },
  ];

  const membersWithSubscriptionStatus = members.map(member => ({
    ...member,
    hasSubscription: abonnementsData?.data.some(abonnement => abonnement.memberID === member.id)
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
      setEditAbonnement({ ...editAbonnement, memberID: selectedMember?.id || '' });
    } else {
      setNewAbonnement({ ...newAbonnement, memberID: selectedMember?.id || '' });
    }
  };
  const handleRequestSort = (event: React.MouseEvent<unknown>, property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
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
    
    if (!(editAbonnement ? editAbonnement.registredDate : newAbonnement.registredDate)) {
      newErrors.registredDate = "Registration date is required";
    }
    
    const leaveDate = editAbonnement ? editAbonnement.leaveDate : newAbonnement.leaveDate;
    if (!leaveDate) {
      newErrors.leaveDate = "Leave date is required"; 
    } else if (new Date(leaveDate) <= new Date(editAbonnement?.registredDate || newAbonnement.registredDate || new Date())) {
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
      const selectedPrice = prices.find(p => p.id === (editAbonnement ? editAbonnement.priceId : newAbonnement.priceId));
      const stayedPeriode = selectedPrice ? `${selectedPrice.name} (${selectedPrice.timePeriod.start} ${selectedPrice.timePeriod.end})` : '';
  
      if (editAbonnement) {
        await updateAbonnement({
          id: editAbonnement.id,
          data: {
            ...editAbonnement,
            stayedPeriode 
          
          },
        }).unwrap();
      } else {
        await createAbonnement({
          ...newAbonnement,
          stayedPeriode 
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
    const registredDate = editAbonnement?.registredDate || newAbonnement.registredDate || new Date();
    let leaveDate = new Date(registredDate);
    
    // Convertir le nom du prix en minuscules pour une comparaison insensible à la casse
    const priceName = price.name.toLowerCase();
    
    // Calcul de la leaveDate en fonction du type de prix
    if (priceName.includes('semaine') || priceName.includes('week')) {
      if (priceName.includes('2') || priceName.includes('deux') || priceName.includes('two')) {
        leaveDate.setDate(leaveDate.getDate() + 14); // 2 semaines = 14 jours
      } else {
        leaveDate.setDate(leaveDate.getDate() + 7); // 1 semaine = 7 jours
      }
    } else if (priceName.includes('mois') || priceName.includes('month')) {
      if (priceName.includes('3')) {
        leaveDate.setMonth(leaveDate.getMonth() + 3);
      } else if (priceName.includes('6')) {
        leaveDate.setMonth(leaveDate.getMonth() + 6);
      } else {
        leaveDate.setMonth(leaveDate.getMonth() + 1); // 1 mois par défaut
      }
    } else if (priceName.includes('année') || priceName.includes('year')) {
      leaveDate.setFullYear(leaveDate.getFullYear() + 1);
    }
  
    const update = {
      priceId: price.id,
      payedAmount: price.price,
      leaveDate: leaveDate
    };
  
    if (editAbonnement) {
      setEditAbonnement({ ...editAbonnement, ...update });
    } else {
      setNewAbonnement({ ...newAbonnement, ...update });
    }
  };
  const getDurationDescription = (priceName: string) => {
    const name = priceName.toLowerCase();
    
    if (name.includes('semaine') || name.includes('week')) {
      if (name.includes('2') || name.includes('deux') || name.includes('two')) {
        return '2 weeks' ;
      }
      return '1 week';
    } else if (name.includes('mois') || name.includes('month')) {
      if (name.includes('3')) {
        return '3 months';
      } else if (name.includes('6')) {
        return '6 months ';
      }
      return '1 month ';
    } else if (name.includes('année') || name.includes('year')) {
      return '1 year';
    }
    return '';
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  if (isLoading) return <CircularProgress />;
  if (isError) return <Alert severity="error">Error loading subscriptions</Alert>;
  const handleNewMember = (member: Member) => {
    setMember(member);
    if (editAbonnement) {
      setEditAbonnement({ ...editAbonnement, memberID: member.id });
    } else {
      setNewAbonnement({ ...newAbonnement, memberID: member.id });
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
    <ProtectedRoute>
     
        <PageContainer>
          
          <MainContainer>
            <TableHeadAction
              handleClickOpen={() => setShowDrawer(true)}
              onHandleSearch={handleSearch}
              search={search}
              refetch={refetch}
              isMobile={isMobile}
            />

            <TableWrapper>
              <StyledTableContainer>
                <Table stickyHeader aria-label="subscriptions table">
                  <EnhancedTableHead
                    numSelected={selected.length}
                    order={order}
                    orderBy={orderBy}
                    onSelectAllClick={handleSelectAllClick}
                    onRequestSort={handleRequestSort}
                    rowCount={abonnementsData?.data.length || 0}
                    headCells={headCells}
                    isMobile={isMobile}
                  />
                  <TableBody>
                    {abonnementsData?.data.map((abonnement) => {
                      const member = members.find(m => m.id === abonnement.memberID);
                      const price = prices.find(p => p.id === abonnement.priceId);
                      const leaveDate = abonnement.leaveDate ? new Date(abonnement.leaveDate) : null;
                      const today = new Date();
                      const shouldBlink = leaveDate && isSameDay(leaveDate, today);
                      const TableRowComponent = shouldBlink ? BlinkingTableRow : TableRow;
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
                              inputProps={{ 'aria-labelledby': abonnement.id }}
                            />
                          </ResponsiveTableCell>
                          <ResponsiveTableCell>
                            {member ? `${member.firstName} ${member.lastName}` : "N/A"}
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
                                {price ? `${price.name} (${price.timePeriod.start} ${price.timePeriod.end})` : "N/A"}
                              </ResponsiveTableCell>
                              <ResponsiveTableCell>
                                {abonnement.payedAmount } DT
                              </ResponsiveTableCell>
                              <ResponsiveTableCell>
                                <Box
                                  sx={{
                                    color: abonnement.isPayed ? 'success.main' : 'error.main',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {abonnement.isPayed ? "Paid" : "Unpaid"}
                                </Box>
                              </ResponsiveTableCell>
                            </>
                          )}
                          <ResponsiveTableCell align={isMobile ? 'right' : 'center'}>
                            <ResponsiveActions>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditAbonnement({ 
                                    ...abonnement, 
                                    leaveDate: abonnement.leaveDate ? new Date(abonnement.leaveDate) : new Date() 
                                  });
                                  setShowDrawer(true);
                                }}
                                size={isMobile ? 'small' : 'medium'}
                              >
                                <EditIcon color="primary" />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAbonnementToDelete(abonnement.id);
                                  setShowDeleteModal(true);
                                }}
                                size={isMobile ? 'small' : 'medium'}
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
                Are you sure you want to delete this subscription? This action cannot be undone.
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
      width: isMobile ? '100%' : "450px", 
      padding: isMobile ? theme.spacing(2) : theme.spacing(3),
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    } 
  }}
>
            <Typography variant="h6" sx={{ mb: 3 }}>
              {editAbonnement ? "Manage Subscription" : "New Subscription"}
            </Typography>

            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!editAbonnement && (
    <ActionButton
      variant="outlined"
      startIcon={<PersonAdd />}
      onClick={() => setOpenMemberModal(true)}
      sx={{ 
        height: '56px',
        width: '200px', // Largeur fixe pour le bouton
        alignSelf: 'flex-start' // Alignement à gauche
      }}
    >
      New Member
    </ActionButton>
  )}

  {/* Sélecteur de membre avec largeur réduite */}
  <FormControl sx={{ 
    width: '100%', 
    maxWidth: '400', // Largeur maximale réduite
    '& .MuiInputBase-root': {
      height: '50px'
    }
  }} error={!!errors.memberID}>
    <InputLabel>Member *</InputLabel>
    <Select
      value={editAbonnement?.memberID || newAbonnement.memberID || ''}
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
            opacity: member.hasSubscription && !editAbonnement ? 0.7 : 1,
            fontStyle: member.hasSubscription && !editAbonnement ? 'italic' : 'normal',
            py: 2
          }}
        >
          {member.firstName} {member.lastName}
          {member.hasSubscription && !editAbonnement && ' (Already subscribed)'}
        </MenuItem>
      ))}
    </Select>
    {errors.memberID && <FormHelperText>{errors.memberID}</FormHelperText>}
  </FormControl>
</Box>

            <Typography variant="subtitle1" sx={{ mb: 0 }}>
              Select Rate *
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {abonnementPrices.map((price) => (
                <Grid item xs={12} sm={6} key={price.id}>
                 <PriceCard
  sx={{
    border: (editAbonnement?.priceId || newAbonnement.priceId) === price.id ? 
      '2px solid #054547' : '1px solid #ddd',
    backgroundColor: (editAbonnement?.priceId || newAbonnement.priceId) === price.id ? 
      '#f5f9f9' : '#fff',
  }}
  onClick={() => handlePriceSelect(price)}
>
  <CardContent>
   
  <Typography variant="h6" sx={{ mt: 1 }}>
  <Box component="span" sx={{ fontWeight: 'bold' }}>{getDurationDescription(price.name)}</Box>
  {' '}
  <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.9em' }}>
    ({price.timePeriod.start}-{price.timePeriod.end})
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
              value={editAbonnement?.registredDate ? new Date(editAbonnement.registredDate) : newAbonnement.registredDate}
              onChange={(date) => {
                const newDate = date || new Date();
                if (editAbonnement) {
                  setEditAbonnement({ ...editAbonnement, registredDate: newDate });
                } else {
                  setNewAbonnement({ ...newAbonnement, registredDate: newDate });
                }
              }}
              sx={{ width: '100%', mb:0}}
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
              sx={{ width: '100%', mb: 0 }}
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
                value={(editAbonnement?.isPayed ?? newAbonnement.isPayed) ? 'true' : 'false'}
                onChange={(e) => {
                  const value = e.target.value === 'true';
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

            <Box sx={{ display: 'flex', gap: '10px', mt: 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
              <ActionButton
                variant="outlined"
                onClick={handleCloseDrawer}
              >
                Cancel
              </ActionButton>
              <SubmitButton
                variant="contained"
                onClick={handleSubmit}
              >
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
      width: isMobile ? '100%' : "450px", 
      padding: isMobile ? theme.spacing(2) : theme.spacing(3),
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    } 
  }}
  ModalProps={{
    hideBackdrop: true
  }}
>
 
  <Typography 
    variant="h6" 
    sx={{ 
      textAlign: 'left',
      fontWeight: 'bold',
      color: 'gris'
    }}
  >
    Manage Member
  </Typography>
  

  <Divider 
    sx={{ 
      backgroundColor: theme.palette.grey[300],
      my: 1 
    }} 
  />
  

  <UserForm
    handleClose={() => setOpenMemberModal(false)}
    selectItem={null}
    handleNewMember={handleNewMember}
  />
</Drawer>
        </PageContainer>
    
    </ProtectedRoute>
  );
};

export default AbonnementComponent;



