import React, { useState } from "react";
import { useGetPricesQuery, useCreatePriceMutation, useUpdatePriceMutation, useDeletePriceMutation } from "src/api/price.repo";
import { Price, PriceType } from "src/types/shared";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash,faSearch } from '@fortawesome/free-solid-svg-icons';
import { Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, MenuItem, Select, TextField } from "@mui/material";
import DashboardLayout from "../../layouts/Dashboard"; 

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

  const [editPrice, setEditPrice] = useState<Price | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleAddPrice = async () => {
    try {
      await createPrice(newPrice).unwrap();
      setShowModal(false);
      console.log("Prix ajouté avec succès !");
    } catch (error) {
      console.error("Erreur lors de l'ajout du prix :", error);
    }
  };

  const handleUpdatePrice = async () => {
    if (editPrice) {
      try {
        const { id, createdAt, updatedAt, ...data } = editPrice; // Exclure `id`, `createdAt`, `updatedAt`
        await updatePrice({ id, data }).unwrap();
        setEditPrice(null);
        setShowModal(false);
        console.log("Prix mis à jour avec succès !");
      } catch (error) {
        console.error("Erreur lors de la mise à jour du prix :", error);
      }
    }
  };
  

  const handleDeletePrice = async (id: string) => {
    await deletePrice(id);
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
    padding: "8px",
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
      setShowModal(true); 
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
                <TableCell>TimePeriod</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPrices?.map((price) => (
                <TableRow key={price.id}>
                  <TableCell>{price.name}</TableCell>
                  <TableCell>{price.price}D</TableCell>
                  <TableCell>{price.timePeriod}</TableCell>
                  <TableCell>{price.type}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => { setEditPrice(price); setShowModal(true); }} color="primary">
                      <FontAwesomeIcon icon={faEdit} />
                    </IconButton>
                    <IconButton onClick={() => handleDeletePrice(price.id)} color="secondary">
                      <FontAwesomeIcon icon={faTrash} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {showModal && (
          <div
            style={{
              position: "fixed",
              top: "50px",
              right: 0,
              width: "400px",
              height: "calc(100% - 50px)",
              backgroundColor: "#fff",
              boxShadow: "-2px 0 5px rgba(0,0,0,0.1)",
              padding: "20px",
              zIndex: 1000,
            }}
          >
            <h3>{editPrice ? "Update Rate" : "Add Rate"}</h3>

            {/* Form Modal Inputs (Name, Price, TimePeriod, Type) */}
            <div style={{ marginBottom: "10px" }}>
              <label>Name</label>
              <input
                type="text"
                value={editPrice ? editPrice.name : newPrice.name}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, name: e.target.value }) : setNewPrice({ ...newPrice, name: e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>Price</label>
              <input
                type="number"
                value={editPrice ? editPrice.price : newPrice.price}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, price: +e.target.value }) : setNewPrice({ ...newPrice, price: +e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>TimePeriod</label>
              <input
                type="text"
                value={editPrice ? editPrice.timePeriod : newPrice.timePeriod}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, timePeriod: e.target.value }) : setNewPrice({ ...newPrice, timePeriod: e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label>Type</label>
              <Select
                value={editPrice ? editPrice.type : newPrice.type}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, type: e.target.value as PriceType }) : setNewPrice({ ...newPrice, type: e.target.value as PriceType }))}
                fullWidth
              >
                <MenuItem value="journal">Journal</MenuItem>
                <MenuItem value="abonnement">Abonnement</MenuItem>
              </Select>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
              <button
                onClick={editPrice ? handleUpdatePrice : handleAddPrice}
                style={{
                  backgroundColor: "#1976d2",
                  color: "white",
                  padding: "12px 20px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  flex: "1",
                  marginRight: "10px",
                }}
              >
                {editPrice ? "Update" : "Add"}
              </button>

              <button
                onClick={() => setShowModal(false)}
                style={{
                  backgroundColor: "#9E9E9E",
                  color: "white",
                  padding: "12px 20px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  flex: "1",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PriceComponent;
