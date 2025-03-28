import React, { useState } from "react";
import { useGetPricesQuery, useCreatePriceMutation, useUpdatePriceMutation, useDeletePriceMutation } from "src/api/price.repo";
import { Price, PriceType, TimeInterval } from "src/types/shared";
import { Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, MenuItem, Select, TextField, FormHelperText, FormControl, Drawer, styled } from "@mui/material";
import { LoadingButton } from "@mui/lab";
import DashboardLayout from "../../layouts/Dashboard"; 
import EditIcon from '@mui/icons-material/Edit';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@mui/material";
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

const PriceComponent: React.FC = () => {
  const { data: prices, isLoading, isError, refetch } = useGetPricesQuery();
  const [createPrice] = useCreatePriceMutation();
  const [updatePrice] = useUpdatePriceMutation();
  const [deletePrice] = useDeletePriceMutation();
  const [searchTerm, setSearchTerm] = useState("");
  const [newPrice, setNewPrice] = useState<Price>({
    id: "",
    name: "",
    price: 0,
    timePeriod: { start: "", end: "" },
    createdAt: null,
    updatedAt: null,
    type: PriceType.journal, 
    journals: []
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<Price | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    
    if (!(editPrice ? editPrice.name : newPrice.name)) errors.name = "Name is required";
    if ((editPrice ? editPrice.price : newPrice.price) <= 0) errors.price = "Price must be greater than 0";
    if (!(editPrice ? editPrice.timePeriod.start : newPrice.timePeriod.start)) errors.timePeriodStart = "Start time is required";
    if (!(editPrice ? editPrice.timePeriod.end : newPrice.timePeriod.end)) errors.timePeriodEnd = "End time is required";
    if (!(editPrice ? editPrice.type : newPrice.type)) errors.type = "Type is required";
  
    setErrors(errors);
    
    return Object.keys(errors).length === 0;
  };
  
  const handleAddPrice = async () => {
    setErrors({});
    if (validateForm()) {
      try {
        await createPrice(newPrice).unwrap();
        setShowDrawer(false);
        setNewPrice({ 
          id: "", 
          name: "", 
          price: 0, 
          timePeriod: { start: "", end: "" }, 
          createdAt: null, 
          updatedAt: null, 
          type: PriceType.journal,
          journals: []
        });
      } catch (error) {
        console.error("Error adding price:", error);
      }
    }
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditPrice(null);
    setErrors({});
  };

  const handleUpdatePrice = async () => {
    setErrors({});
    if (editPrice && validateForm()) {
      try {
        const { id, createdAt, updatedAt, ...data } = editPrice;
        await updatePrice({ id, data }).unwrap();
        setEditPrice(null);
        setShowDrawer(false);
      } catch (error) {
        console.error("Error updating price:", error);
      }
    }
  };

  const confirmDeletePrice = (id: string) => {
    setPriceToDelete(id);
    setShowDeleteModal(true);
  };
  
  const handleConfirmDelete = async () => {
    if (priceToDelete) {
      await deletePrice(priceToDelete);
      setShowDeleteModal(false);
      setPriceToDelete(null);
    }
  };
  const [typeFilter, setTypeFilter] = useState<PriceType | 'all'>('all');
  const formatTimeInterval = (interval: TimeInterval) => {
    return `${interval.start} - ${interval.end}`;
  };

  const filteredPrices = prices?.filter((price) => {
    const matchesSearch = price.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || price.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
  <div style={{ padding: "20px" }}>
    <h2>Rate Management</h2>

    {/* Conteneur flex avec espace entre les éléments */}
    <div style={{ 
      display: 'flex',
      justifyContent: 'space-between', // Alignement à gauche et droite
      alignItems: 'center',
      marginBottom: '20px'
    }}>
      {/* Champ de recherche à gauche */}
      <div style={{ flex: 1, maxWidth: '400px' }}>
        <BulkActions 
          handleClickOpen={() => {
            setNewPrice({ 
              id: "", 
              name: "", 
              price: 0, 
              timePeriod: { start: "", end: "" }, 
              createdAt: null, 
              updatedAt: null, 
              type: PriceType.journal,
              journals: []
            }); 
            setShowDrawer(true);
          }}
          onHandleSearch={handleSearch}
          search={searchTerm}
          refetch={refetch}
        />
      </div>

      {/* Filtre à droite */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <FormControl sx={{ 
          width: '200px',
          height: '40px',
          '& .MuiOutlinedInput-root': {
            height: '40px'
          }
        }}>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PriceType | 'all')}
            displayEmpty
            sx={{
              height: '40px',
              fontSize: '14px',
              '& .MuiSelect-select': {
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center'
              }
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  marginTop: '8px',
                  maxHeight: '300px'
                }
              }
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '14px' }}>Tous les types</MenuItem>
            <MenuItem value={PriceType.journal} sx={{ fontSize: '14px' }}>Journal</MenuItem>
            <MenuItem value={PriceType.abonnement} sx={{ fontSize: '14px' }}>Abonnement</MenuItem>
          </Select>
        </FormControl>
      </div>
    </div>

    <TableContainer component={Paper}>
      <Table>
        <StyledTableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>Time Period</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </StyledTableHead>
        <TableBody>
          {filteredPrices?.map((price) => (
            <StyledTableRow key={price.id}>
              <TableCell>{price.name}</TableCell>
              <TableCell>{price.price} D</TableCell>
              <TableCell>{formatTimeInterval(price.timePeriod)}</TableCell>
              <TableCell>{price.type}</TableCell>
              <TableCell align="center">
                <IconButton 
                  onClick={() => { setEditPrice(price); setShowDrawer(true); }}
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
                  onClick={() => confirmDeletePrice(price.id)}
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
          Are you sure you want to delete this rate? This action is irreversible.
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
        <h3>{editPrice ? "Manage Rate" : "New Rate"}</h3>
        <TextField 
          label="Name" 
          fullWidth 
          margin="dense" 
          value={editPrice ? editPrice.name : newPrice.name} 
          onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, name: e.target.value }) : setNewPrice({ ...newPrice, name: e.target.value }))}
          error={!!errors.name}
          helperText={errors.name}
        />
        <TextField 
          label="Price" 
          fullWidth 
          margin="dense" 
          type="number" 
          value={editPrice ? editPrice.price : newPrice.price} 
          onChange={(e) => {
            const value = Math.max(0, +e.target.value);
            editPrice
              ? setEditPrice({ ...editPrice, price: value })
              : setNewPrice({ ...newPrice, price: value });
          }}
          error={!!errors.price}
          helperText={errors.price}
        />
        <TextField 
          label="Start Time" 
          fullWidth 
          margin="dense" 
          value={editPrice ? editPrice.timePeriod.start : newPrice.timePeriod.start} 
          onChange={(e) => 
            editPrice 
              ? setEditPrice({ 
                  ...editPrice, 
                  timePeriod: { ...editPrice.timePeriod, start: e.target.value } 
                }) 
              : setNewPrice({ 
                  ...newPrice, 
                  timePeriod: { ...newPrice.timePeriod, start: e.target.value } 
                })
          } 
          error={!!errors.timePeriodStart}
          helperText={errors.timePeriodStart}
        />
        <TextField 
          label="End Time" 
          fullWidth 
          margin="dense" 
          value={editPrice ? editPrice.timePeriod.end : newPrice.timePeriod.end} 
          onChange={(e) => 
            editPrice 
              ? setEditPrice({ 
                  ...editPrice, 
                  timePeriod: { ...editPrice.timePeriod, end: e.target.value } 
                }) 
              : setNewPrice({ 
                  ...newPrice, 
                  timePeriod: { ...newPrice.timePeriod, end: e.target.value } 
                })
          } 
          error={!!errors.timePeriodEnd}
          helperText={errors.timePeriodEnd}
        />
        <FormControl fullWidth margin="dense" error={!!errors.type}>
          <Select
            value={editPrice ? editPrice.type : newPrice.type}
            onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, type: e.target.value as PriceType }) : setNewPrice({ ...newPrice, type: e.target.value as PriceType }))} 
          >
            <MenuItem value="journal">Journal</MenuItem>
            <MenuItem value="abonnement">Abonnement</MenuItem>
          </Select>
          {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
        </FormControl>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <SubmitButtton 
            onClick={editPrice ? handleUpdatePrice : handleAddPrice}
          >
            {editPrice ? "Update" : "Add"}
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

export default PriceComponent;