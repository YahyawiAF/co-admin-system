import React, { useState } from "react";
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
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DatePicker } from "@mui/x-date-pickers";
import DashboardLayout from "../../layouts/Dashboard";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import BulkActions from "src/components/Table/members/TableHeader";

// Styles personnalisés
const SubmitButton = styled(LoadingButton)(() => ({
  border: "1px solid",
  borderColor: "#054547",
  background: "#fff",
  color: "#054547",
  width: "calc(50% - 5px)",
  height: "50px",
  lineHeight: "50px",
  cursor: "pointer",
  marginLeft: "10px",
  borderRadius: 0,
  margin: 0,
  "&:hover": {
    background: "#054547",
    color: "#fff",
  },
}));

const ActionButton = styled(Button)(() => ({
  border: "1px solid",
  borderColor: "#054547",
  background: "#fff",
  color: "#054547",
  width: "calc(50% - 5px)",
  height: "50px",
  lineHeight: "50px",
  cursor: "pointer",
  borderRadius: 0,
  margin: 0,
  "&:hover": {
    background: "#054547",
    color: "#fff",
  },
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
}));

const blinkAnimation = keyframes`
  0% { background-color: rgba(255, 0, 0, 0.1); }
  50% { background-color: rgba(255, 0, 0, 0.4); }
  100% { background-color: rgba(255, 0, 0, 0.1); }
`;

const BlinkingTableRow = styled(TableRow)(({ theme }) => ({
  animation: `${blinkAnimation} 1.5s ease-in-out infinite`,
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(even)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
  },
}));

const PriceCard = ({ price, isSelected, onClick }: { price: Price; isSelected: boolean; onClick: () => void }) => (
  <Card
    onClick={onClick}
    sx={{
      cursor: 'pointer',
      border: isSelected ? '2px solid #054547' : '1px solid #ddd',
      backgroundColor: isSelected ? '#f5f9f9' : '#fff',
      transition: 'all 0.3s ease',
      '&:hover': {
        borderColor: '#054547',
        backgroundColor: '#f5f9f9',
      },
    }}
  >
    <CardContent>
      <Typography variant="subtitle1" fontWeight="bold">{price.name}</Typography>
      <Typography variant="body2" color="text.secondary">
        {price.timePeriod?.start} - {price.timePeriod?.end}
      </Typography>
      <Typography variant="h6" sx={{ mt: 1 }}>
        {price.price} DT
      </Typography>
    </CardContent>
  </Card>
);

interface AbonnementFormData extends Partial<Abonnement> {
  registredDate: Date;
  leaveDate: Date;
  payedAmount: number;
}

// Fonction utilitaire pour comparer les dates (sans l'heure)
const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};



const AbonnementComponent = () => {
  const [search, setSearch] = useState("");
  // Fetch data
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

  // Mutations
  const [createAbonnement] = useCreateAbonnementMutation();
  const [updateAbonnement] = useUpdateAbonnementMutation();
  const [deleteAbonnement] = useDeleteAbonnementMutation();

  // State
  const [newAbonnement, setNewAbonnement] = useState<AbonnementFormData>({
    registredDate: new Date(),
    leaveDate: new Date(),
    payedAmount: 0,
    isPayed: false,
    isReservation: false,
  });
  const [editAbonnement, setEditAbonnement] = useState<Abonnement | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [abonnementToDelete, setAbonnementToDelete] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get available members (not already subscribed)
// Get all members and mark subscribed ones
const membersWithSubscriptionStatus = members.map(member => ({
  ...member,
  hasSubscription: abonnementsData?.data.some(abonnement => abonnement.memberID === member.id)
}));

  // Helper functions
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString();
    } catch (e) {
      return "Invalid date";
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!(editAbonnement ? editAbonnement.registredDate : newAbonnement.registredDate)) {
      newErrors.registredDate = "Registration date is required";
    }
    
    if (!(editAbonnement ? editAbonnement.leaveDate : newAbonnement.leaveDate)) {
      newErrors.leaveDate = "Leave date is required"; 
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
      if (editAbonnement) {
        await updateAbonnement({
          id: editAbonnement.id,
          data: editAbonnement,
        }).unwrap();
      } else {
        await createAbonnement(newAbonnement).unwrap();
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
    const update = {
      priceId: price.id,
      payedAmount: price.price,
    };

    if (editAbonnement) {
      setEditAbonnement({ ...editAbonnement, ...update });
    } else {
      setNewAbonnement({ ...newAbonnement, ...update });
    }
  };

  if (isLoading) return <CircularProgress />;
  if (isError) return <Alert severity="error">Error loading subscriptions</Alert>;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" sx={{ mb: 3 }}>Subscription Management</Typography>

          <BulkActions
            handleClickOpen={() => setShowDrawer(true)}
            onHandleSearch={handleSearch}
            search={search}
            refetch={refetch}
          />

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <StyledTableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Registered Date</TableCell>
                  <TableCell>Leave Date</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Paid Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </StyledTableHead>
              <TableBody>
              {abonnementsData?.data.map((abonnement) => {
  const member = members.find(m => m.id === abonnement.memberID);
  const price = prices.find(p => p.id === abonnement.priceId);
  
  // Convertir la leaveDate en objet Date
  const leaveDate = abonnement.leaveDate ? new Date(abonnement.leaveDate) : null;
  const today = new Date();
  
  // Vérifier si c'est la date d'aujourd'hui (doit clignoter)
  const shouldBlink = leaveDate && isSameDay(leaveDate, today);

  const TableRowComponent = shouldBlink ? BlinkingTableRow : StyledTableRow;

  return (
    <TableRowComponent key={abonnement.id}>
      {/* Le reste du code reste inchangé */}
      <TableCell>
        {member ? `${member.firstName} ${member.lastName}` : "N/A"}
      </TableCell>
      <TableCell>{formatDate(abonnement.registredDate)}</TableCell>
      <TableCell>{formatDate(abonnement.leaveDate)}</TableCell>
      <TableCell>
        {price ? `${price.name} (${price.timePeriod.start} ${price.timePeriod.end})` : "N/A"}
      </TableCell>
      <TableCell>{abonnement.payedAmount} DT</TableCell>
      <TableCell>
        <Box
          sx={{
            color: abonnement.isPayed ? 'success.main' : 'error.main',
            fontWeight: 'bold'
          }}
        >
          {abonnement.isPayed ? "Paid" : "Unpaid"}
        </Box>
      </TableCell>
      <TableCell align="center">
        <IconButton
          onClick={() => {
            setEditAbonnement({ 
              ...abonnement, 
              leaveDate: abonnement.leaveDate ? new Date(abonnement.leaveDate) : new Date() 
            });
            setShowDrawer(true);
          }}
        >
          <EditIcon color="primary" />
        </IconButton>
        <IconButton
          onClick={() => {
            setAbonnementToDelete(abonnement.id);
            setShowDeleteModal(true);
          }}
        >
          <DeleteIcon color="error" />
        </IconButton>
      </TableCell>
    </TableRowComponent>
  );
})}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
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

          {/* Add/Edit Drawer */}
          <Drawer
            anchor="right"
            open={showDrawer}
            onClose={handleCloseDrawer}
            PaperProps={{ 
              sx: { 
                width: "450px", 
                padding: "25px",
                display: "flex",
                flexDirection: "column",
                gap: "20px"
              } 
            }}
          >
            <Typography variant="h6" sx={{ mb: 3 }}>
              {editAbonnement ? "Manage Subscription" : "New Subscription"}
            </Typography>

            <FormControl fullWidth sx={{ mb: 0 }} error={!!errors.memberID}>
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
          fontStyle: member.hasSubscription && !editAbonnement ? 'italic' : 'normal'
        }}
      >
        {member.firstName} {member.lastName}
        {member.hasSubscription && !editAbonnement && ' (Already subscribed)'}
      </MenuItem>
    ))}
  </Select>
  {errors.memberID && <FormHelperText>{errors.memberID}</FormHelperText>}
</FormControl>

            <Typography variant="subtitle1" sx={{ mb: 0 }}>
              Select Rate *
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {abonnementPrices.map((price) => (
                <Grid item xs={6} key={price.id}>
                  <PriceCard
                    price={price}
                    isSelected={
                      (editAbonnement?.priceId || newAbonnement.priceId) === price.id
                    }
                    onClick={() => handlePriceSelect(price)}
                  />
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

            <Box sx={{ display: 'flex',  gap: '10px', mt: 'auto', justifyContent: 'space-between' }}>
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
        </Box>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default AbonnementComponent;