import React, { useState } from "react";
import { useGetPricesQuery, useCreatePriceMutation, useUpdatePriceMutation, useDeletePriceMutation } from "src/api/price.repo";
import { Price, PriceType } from "src/types/shared";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

import DashboardLayout from "../../layouts/Dashboard"; // Assurez-vous que ce layout inclut Navbar et Sidebar

const PriceComponent: React.FC = () => {
  const { data: prices, isLoading, isError } = useGetPricesQuery();
  const [createPrice] = useCreatePriceMutation();
  const [updatePrice] = useUpdatePriceMutation();
  const [deletePrice] = useDeletePriceMutation();

  const [newPrice, setNewPrice] = useState<Price>({
    id: "",
    name: "",
    price: 0,
    timePeriod: "",
    createdAt: null,
    updatedAt: null,
    type: [],
  });

  const [editPrice, setEditPrice] = useState<Price | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleAddPrice = async () => {
    const formattedPrice: Price = { ...newPrice, type: newPrice.type.map(t => t as PriceType) };
    try {
      await createPrice(formattedPrice).unwrap();
      setShowModal(false);
      console.log("Prix ajouté avec succès !");
    } catch (error) {
      console.error("Erreur lors de l'ajout du prix :", error);
    }
  };

  const handleUpdatePrice = async () => {
    if (editPrice) {
      await updatePrice({ id: editPrice.id, data: editPrice });
      setEditPrice(null);
      setShowModal(false);
    }
  };

  const handleDeletePrice = async (id: string) => {
    await deletePrice(id);
  };

  const handleTypeChange = (selectedTypes: string[], isEditing = false) => {
    const updatedTypes = selectedTypes.map((type) => type as PriceType);
    if (isEditing && editPrice) {
      setEditPrice({ ...editPrice, type: updatedTypes });
    } else {
      setNewPrice({ ...newPrice, type: updatedTypes });
    }
  };

  if (isLoading) return <p>Chargement...</p>;
  if (isError) return <p>Erreur lors du chargement des prix.</p>;

  return (
    <DashboardLayout>
      <div style={{ padding: "20px" }}>
        <h2>Gestion des Prix</h2>

        <Button
  onClick={() => { setNewPrice({ id: "", name: "", price: 0, timePeriod: "", createdAt: null, updatedAt: null, type: [] }); setShowModal(true); }}
  variant="contained"
  color="primary"
  style={{ 
    marginBottom: "10px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: "5px",   // Réduction du padding pour un bouton plus petit
    borderRadius: "50%", 
    width: "30px",    // Taille plus petite
    height: "30px",   // Taille plus petite
    minWidth: "30px"  // Assure que la taille minimale soit petite
  }}
>
  <FontAwesomeIcon icon={faPlus} style={{ fontSize: "14px", color: "white" }} />  {/* Ajustement de la taille de l'icône */}
</Button>



        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Prix</TableCell>
                <TableCell>Période</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prices?.map((price) => (
                <TableRow key={price.id}>
                  <TableCell>{price.name}</TableCell>
                  <TableCell>{price.price}€</TableCell>
                  <TableCell>{price.timePeriod}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => { setEditPrice(price); setShowModal(true); }}
                      color="primary"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDeletePrice(price.id)}
                      color="secondary"
                    >
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
              top: "50px", // Décale le modal sous la navbar, ajuste cette valeur si nécessaire
              right: 0,
              width: "300px",
              height: "calc(100% - 50px)", // Si tu veux que le modal prenne toute la hauteur sauf la hauteur du navbar
              backgroundColor: "#fff",
              boxShadow: "-2px 0 5px rgba(0,0,0,0.1)",
              padding: "20px",
              zIndex: 1000, // Assure-toi que le z-index du modal est plus élevé que celui de la navbar
            }}
          >
            <h3>{editPrice ? "Modifier le prix" : "Ajouter un prix"}</h3>
            <div style={{ marginBottom: "10px" }}>
              <label>Nom du tarif</label>
              <input
                type="text"
                value={editPrice ? editPrice.name : newPrice.name}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, name: e.target.value }) : setNewPrice({ ...newPrice, name: e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label>Prix</label>
              <input
                type="number"
                value={editPrice ? editPrice.price : newPrice.price}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, price: +e.target.value }) : setNewPrice({ ...newPrice, price: +e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label>Période (ex: 1 mois)</label>
              <input
                type="text"
                value={editPrice ? editPrice.timePeriod : newPrice.timePeriod}
                onChange={(e) => (editPrice ? setEditPrice({ ...editPrice, timePeriod: e.target.value }) : setNewPrice({ ...newPrice, timePeriod: e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
              />
            </div>
            <button
              onClick={editPrice ? handleUpdatePrice : handleAddPrice}
              style={{
                backgroundColor: "#1976d2", // Bleu primaire de Material UI
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
              
            >
              {editPrice ? "Mettre à jour" : "Ajouter"}
            </button>
            <button
              onClick={() => setShowModal(false)}
              style={{
                backgroundColor: "#9E9E9E",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginLeft: "10px",
              }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PriceComponent;
