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
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DatePicker } from "@mui/x-date-pickers";
import DashboardLayout from "../../layouts/Dashboard";
import EditIcon from '@mui/icons-material/Edit';
import ProtectedRoute from "src/components/auth/ProtectedRoute";
import BulkActions from "src/components/Table/members/TableHeader";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

// Styles des boutons réutilisés
const SubmitButtton = styled(LoadingButton)(() => ({
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
}));

const ActionButtton = styled(Button)(() => ({
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
}));

// Style pour la table
const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  "& .MuiTableCell-root": {
    fontWeight: "bold",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(even)": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:hover": {
    backgroundColor: theme.palette.action.selected,
  },
}));

interface AbonnementFormData extends Omit<Partial<Abonnement>, 'id' | 'createdAt' | 'updatedAt'> {
  isPayed: boolean;
  registredDate: Date;
  payedAmount: number;
  isReservation: boolean;
}

const AbonnementComponent: React.FC = () => {
  // Fetch data
  const { data: abonnementsData, refetch } = useGetAbonnementsQuery({});
  const { data: members = [] } = useGetMembersQuery();
  const { data: prices = [] } = useGetPricesQuery();
  
  // Mutations
  const [createAbonnement] = useCreateAbonnementMutation();
  const [updateAbonnement] = useUpdateAbonnementMutation();
  const [deleteAbonnement] = useDeleteAbonnementMutation();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [newAbonnement, setNewAbonnement] = useState<AbonnementFormData>({
    isPayed: false,
    registredDate: new Date(),
    payedAmount: 0,
    isReservation: false,
    memberID: null,
    priceId: null,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [abonnementToDelete, setAbonnementToDelete] = useState<string | null>(null);
  const [editAbonnement, setEditAbonnement] = useState<Abonnement | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const abonnements = abonnementsData?.data || [];

  // Helper functions
  const findMemberById = (id: string | null) => members.find(m => m.id === id);
  const findPriceById = (id: string | null) => prices.find(p => p.id === id);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    
    if (!(editAbonnement ? editAbonnement.registredDate : newAbonnement.registredDate)) {
      errors.registredDate = "Registration date is required";
    }
    if ((editAbonnement ? editAbonnement.payedAmount : newAbonnement.payedAmount) < 0) {
      errors.payedAmount = "Amount must be positive";
    }
    
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleAddAbonnement = async () => {
    setErrors({});
    if (validateForm()) {
      try {
        const abonnementToCreate: Abonnement = {
          ...newAbonnement,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          leaveDate: newAbonnement.leaveDate || null,
          stayedPeriode: newAbonnement.stayedPeriode || null,
          member: findMemberById(newAbonnement.memberID || null) || null,
          priceId: newAbonnement.priceId || null,
        
        };
        
        await createAbonnement(abonnementToCreate).unwrap();
        setShowDrawer(false);
        resetForm();
      } catch (error) {
        console.error("Error adding abonnement:", error);
      }
    }
  };

  const resetForm = () => {
    setNewAbonnement({ 
      isPayed: false,
      registredDate: new Date(),
      payedAmount: 0,
      isReservation: false,
      memberID: null,
      priceId: null,
    });
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditAbonnement(null);
    setErrors({});
  };

  const handleUpdateAbonnement = async () => {
    setErrors({});
    if (editAbonnement && validateForm()) {
      try {
        await updateAbonnement({ 
          id: editAbonnement.id, 
          data: {
            ...editAbonnement,
            updatedAt: new Date(),
            member: findMemberById(editAbonnement.memberID || null) || null,
            priceId: editAbonnement.priceId || null,
          }
        }).unwrap();
        setEditAbonnement(null);
        setShowDrawer(false);
      } catch (error) {
        console.error("Error updating abonnement:", error);
      }
    }
  };

  const confirmDeleteAbonnement = (id: string) => {
    setAbonnementToDelete(id);
    setShowDeleteModal(true);
  };
  
  const handleConfirmDelete = async () => {
    if (abonnementToDelete) {
      await deleteAbonnement(abonnementToDelete);
      setShowDeleteModal(false);
      setAbonnementToDelete(null);
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  const filteredAbonnements = abonnements.filter((abonnement: Abonnement) =>
    abonnement.member?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    abonnement.member?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div style={{ padding: "20px" }}>
          <h2>Subscription Management</h2>

          <BulkActions 
            handleClickOpen={() => {
              resetForm();
              setShowDrawer(true);
            }}
            onHandleSearch={handleSearch}
            search={searchTerm}
            refetch={refetch}
          />

          <TableContainer component={Paper}>
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
                {filteredAbonnements.map((abonnement: Abonnement) => (
                  <StyledTableRow key={abonnement.id}>
                    <TableCell>
                      {abonnement.member ? `${abonnement.member.firstName} ${abonnement.member.lastName}` : "N/A"}
                    </TableCell>
                    <TableCell>{formatDate(abonnement.registredDate)}</TableCell>
                    <TableCell>{formatDate(abonnement.leaveDate)}</TableCell>
                    <TableCell>{abonnement.price?.name || "N/A"}</TableCell>
                    <TableCell>{abonnement.payedAmount} D</TableCell>
                    <TableCell>{abonnement.isPayed ? "Paid" : "Unpaid"}</TableCell>
                    <TableCell align="center">
                      <IconButton 
                        onClick={() => { setEditAbonnement(abonnement); setShowDrawer(true); }}
                        sx={{ 
                          color: "#054547",
                          '&:hover': { 
                            backgroundColor: 'rgba(5, 69, 71, 0.1)',
                          },
                          padding: "8px",
                          margin: "0 4px"
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        onClick={() => confirmDeleteAbonnement(abonnement.id)}
                        sx={{ 
                          color: "#ff4444",
                          '&:hover': { 
                            backgroundColor: 'rgba(255, 68, 68, 0.1)',
                          },
                          padding: "8px",
                          margin: "0 4px"
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: "16px" }} />
                      </IconButton>
                    </TableCell>
                  </StyledTableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
            <DialogTitle>Confirmation</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete this subscription? This action is irreversible.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDeleteModal(false)} color="primary">
                Cancel
              </Button>
              <Button onClick={handleConfirmDelete} color="secondary" autoFocus>
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
          
          <Drawer anchor="right" open={showDrawer} onClose={handleCloseDrawer}>
            <div style={{ width: "400px", padding: "20px" }}>
              <h3>{editAbonnement ? "Manage Subscription" : "New Subscription"}</h3>
              
              {/* Member Select */}
              <FormControl fullWidth margin="dense">
                <InputLabel>Member</InputLabel>
                <Select
                  value={editAbonnement?.memberID || newAbonnement.memberID || ''}
                  onChange={(e) => {
                    const memberId = e.target.value as string;
                    const member = findMemberById(memberId);
                    
                    if (editAbonnement) {
                      setEditAbonnement({ 
                        ...editAbonnement, 
                        memberID: memberId,
                        member: member || null
                      });
                    } else {
                      setNewAbonnement({ 
                        ...newAbonnement, 
                        memberID: memberId,
                        member: member || null
                      });
                    }
                  }}
                  label="Member"
                >
                  <MenuItem value="">Select a member</MenuItem>
                  {members.map((member: Member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Price Select */}
              <FormControl fullWidth margin="dense">
                <InputLabel>Price</InputLabel>
                <Select
                  value={editAbonnement?.priceId || newAbonnement.priceId || ''}
                  onChange={(e) => {
                    const priceId = e.target.value as string;
                    const price = findPriceById(priceId);
                    
                     if (editAbonnement) {
                      setEditAbonnement({ 
                        ...editAbonnement, 
                        priceId: priceId,
                      
                      });
                    } else {
                      setNewAbonnement({ 
                        ...newAbonnement, 
                        priceId: priceId,
                       
                      });
                    }
                  }}
                  label="Price"
                >
                  <MenuItem value="">Select a price</MenuItem>
                  {prices.map((price: Price) => (
                    <MenuItem key={price.id} value={price.id}>
                      {price.name} ({price.price} D)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <DatePicker
                label="Registration Date"
                value={editAbonnement ? editAbonnement.registredDate : newAbonnement.registredDate}
                onChange={(date: Date | null) => {
                  const selectedDate = date || new Date();
                  if (editAbonnement) {
                    setEditAbonnement({ ...editAbonnement, registredDate: selectedDate });
                  } else {
                    setNewAbonnement({ ...newAbonnement, registredDate: selectedDate });
                  }
                }}
              />
              
              <DatePicker
                label="Leave Date"
                value={editAbonnement ? editAbonnement.leaveDate || null : null}
                onChange={(date: Date | null) => {
                  if (editAbonnement) {
                    setEditAbonnement({ ...editAbonnement, leaveDate: date || null });
                  } else {
                    setNewAbonnement({ ...newAbonnement, leaveDate: date || null });
                  }
                }}
              />
              
              <TextField 
                label="Paid Amount" 
                fullWidth 
                margin="dense" 
                type="number" 
                value={editAbonnement ? editAbonnement.payedAmount : newAbonnement.payedAmount} 
                onChange={(e) => {
                  const value = Math.max(0, +e.target.value);
                  if (editAbonnement) {
                    setEditAbonnement({ ...editAbonnement, payedAmount: value });
                  } else {
                    setNewAbonnement({ ...newAbonnement, payedAmount: value });
                  }
                }}
                error={!!errors.payedAmount}
                helperText={errors.payedAmount}
              />
              
              <FormControl fullWidth margin="dense">
                <TextField
                  label="Is Paid"
                  select
                  value={editAbonnement ? editAbonnement.isPayed.toString() : newAbonnement.isPayed.toString()}
                  onChange={(e) => {
                    const value = e.target.value === 'true';
                    if (editAbonnement) {
                      setEditAbonnement({ ...editAbonnement, isPayed: value });
                    } else {
                      setNewAbonnement({ ...newAbonnement, isPayed: value });
                    }
                  }}
                >
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </TextField>
              </FormControl>
              
              <FormControl fullWidth margin="dense">
                <TextField
                  label="Is Reservation"
                  select
                  value={editAbonnement ? editAbonnement.isReservation.toString() : newAbonnement.isReservation.toString()}
                  onChange={(e) => {
                    const value = e.target.value === 'true';
                    if (editAbonnement) {
                      setEditAbonnement({ ...editAbonnement, isReservation: value });
                    } else {
                      setNewAbonnement({ ...newAbonnement, isReservation: value });
                    }
                  }}
                >
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </TextField>
              </FormControl>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <SubmitButtton 
                  onClick={editAbonnement ? handleUpdateAbonnement : handleAddAbonnement}
                >
                  {editAbonnement ? "Update" : "Add"}
                </SubmitButtton>
                <ActionButtton onClick={handleCloseDrawer}>
                  Cancel
                </ActionButtton>
              </div>
            </div>
          </Drawer>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default AbonnementComponent;