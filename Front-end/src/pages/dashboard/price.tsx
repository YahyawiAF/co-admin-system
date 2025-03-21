import React, { useState } from "react";
import { useGetPricesQuery, useCreatePriceMutation, useUpdatePriceMutation, useDeletePriceMutation } from "src/api/price.repo";
import { Price, PriceType } from "src/types/shared";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faSearch } from '@fortawesome/free-solid-svg-icons';
import { Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, MenuItem, Select, TextField, FormHelperText, FormControl, Drawer } from "@mui/material";
import DashboardLayout from "../../layouts/Dashboard"; 
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@mui/material";

const PriceComponent: React.FC = () => {
  const { data: prices, isLoading, isError } = useGetPricesQuery();
  const [createPrice] = useCreatePriceMutation();
  const [updatePrice] = useUpdatePriceMutation();
  const [deletePrice] = useDeletePriceMutation();
  const [searchTerm, setSearchTerm] = useState("");
  const [newPrice, setNewPrice] = useState<Price>({
    id: "",
    name: "",
    price: 0,
    timePeriod: "",
    createdAt: null,
    updatedAt: null,
    type: PriceType.journal, 
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
    if (!(editPrice ? editPrice.timePeriod : newPrice.timePeriod)) errors.timePeriod = "Time period is required";
    if (!(editPrice ? editPrice.type : newPrice.type)) errors.type = "Type is required";
  
    setErrors(errors);
    
    return Object.keys(errors).length === 0;
  };
  
  const handleAddPrice = async () => {
    setErrors({});  // Réinitialiser les erreurs avant de valider
    if (validateForm()) {
      try {
        await createPrice(newPrice).unwrap();
        setShowDrawer(false);
        setNewPrice({ 
          id: "", 
          name: "", 
          price: 0, 
          timePeriod: "", 
          createdAt: null, 
          updatedAt: null, 
          type: PriceType.journal,
        });
        console.log("Prix ajouté avec succès !");
      } catch (error) {
        console.error("Erreur lors de l'ajout du prix :", error);
      }
    }
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditPrice(null); // Réinitialiser editPrice
    setErrors({}); // Réinitialiser les erreurs
  };

  const handleUpdatePrice = async () => {
    setErrors({});  // Réinitialiser les erreurs avant de valider
    if (editPrice && validateForm()) {
      try {
        const { id, createdAt, updatedAt, ...data } = editPrice;
        await updatePrice({ id, data }).unwrap();
        setEditPrice(null);
        setShowDrawer(false);
        console.log("Prix mis à jour avec succès !");
      } catch (error) {
        console.error("Erreur lors de la mise à jour du prix :", error);
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

  const filteredPrices = prices?.filter((price) =>
    price.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div style={{ padding: "20px" }}>
        <h2>Rate Management</h2>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: "20px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #ccc",
            borderRadius: "5px",
            padding: "9px",
            backgroundColor: "white",
            width: "220px" 
          }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                flex: 1, 
              }}
            />
            <FontAwesomeIcon icon={faSearch} style={{ marginRight: "8px", color: "#aaa" }} />
          </div>

          <Button
            onClick={() => { 
              setNewPrice({ 
                id: "", 
                name: "", 
                price: 0, 
                timePeriod: "", 
                createdAt: null, 
                updatedAt: null, 
                type: PriceType.journal,
              }); 
              setShowDrawer(true); 
            }}
            variant="contained"
            color="primary"
            style={{
              borderRadius: "50%", 
              width: "30px", 
              height: "30px", 
              minWidth: "30px",
              padding: "0", 
              marginLeft: "10px" 
            }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: "16px", color: "white" }} />
          </Button>
        </div>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Time Period</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPrices?.map((price) => (
                <TableRow key={price.id}>
                  <TableCell>{price.name}</TableCell>
                  <TableCell>{price.price} D</TableCell>
                  <TableCell>{price.timePeriod}</TableCell>
                  <TableCell>{price.type}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => { setEditPrice(price); setShowDrawer(true); }} color="primary">
                      <FontAwesomeIcon icon={faEdit} />
                    </IconButton>
                    <IconButton onClick={() => confirmDeletePrice(price.id)} color="secondary">
                      <FontAwesomeIcon icon={faTrash} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
          <DialogTitle>Confirmation</DialogTitle>
          <DialogContent>
            <DialogContentText>
            Are you sure you want to delete this rate? This action is irreversible.            </DialogContentText>
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
                const value = Math.max(0, +e.target.value); // Empêche les valeurs négatives
                editPrice
                  ? setEditPrice({ ...editPrice, price: value })
                  : setNewPrice({ ...newPrice, price: value });
              }}
              error={!!errors.price}
              helperText={errors.price}
            />
            <TextField 
              label="Time Period" 
              fullWidth 
              margin="dense" 
              value={editPrice ? editPrice.timePeriod : newPrice.timePeriod} 
              onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, timePeriod: e.target.value }) : setNewPrice({ ...newPrice, timePeriod: e.target.value }))} 
              error={!!errors.timePeriod}
              helperText={errors.timePeriod}
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
            <Button onClick={editPrice ? handleUpdatePrice : handleAddPrice} color="primary" variant="contained" fullWidth style={{ marginTop: "20px" }}>
              {editPrice ? "Confirm" : "Confirm"}
            </Button>
            <Button onClick={handleCloseDrawer} color="secondary" variant="outlined" fullWidth style={{ marginTop: "10px" }}>
              Cancel
            </Button>
          </div>
        </Drawer>
      </div>
    </DashboardLayout>
  );
};

export default PriceComponent;