import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { format } from "date-fns";
import AddIcon from "@mui/icons-material/Add";
import { useCreateProductMutation, useGetProductsQuery } from "src/api/productApi";
import { Product } from "src/types/shared";

const style = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

interface DailyProductModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { productId: string; quantite: number; date?: string }) => void;
  initialData?: { productId: string; quantite: number; date?: string };
  products?: Product[]; // Optional prop to pass products directly
}

export default function DailyProductModal({
  open,
  onClose,
  onSubmit,
  initialData,
}: DailyProductModalProps) {
  const { data: products = [], isLoading: productsLoading } = useGetProductsQuery();
  const [selectedProductId, setSelectedProductId] = useState(
    initialData?.productId || ""
  );
  const [quantite, setQuantite] = useState(initialData?.quantite || 1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialData?.date ? new Date(initialData.date) : null
  );
  const [openNewProductDialog, setOpenNewProductDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    purchasePrice: 0,
    sellingPrice: 0,
    description: "",
  });
  const [errors, setErrors] = useState({
    name: false,
    purchasePrice: false,
    sellingPrice: false,
  });

  const [createProduct] = useCreateProductMutation();

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setSelectedProductId(initialData.productId || "");
      setQuantite(initialData.quantite || 1);
      setSelectedDate(initialData.date ? new Date(initialData.date) : null);
    }
  }, [initialData]);

  const validateProductForm = () => {
    const newErrors = {
      name: newProduct.name.trim() === "",
      purchasePrice: newProduct.purchasePrice <= 0,
      sellingPrice: newProduct.sellingPrice <= 0,
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleCreateNewProduct = async () => {
    if (!validateProductForm()) return;

    try {
      const createdProduct = await createProduct({
          name: newProduct.name,
          purchasePrice: newProduct.purchasePrice,
          sellingPrice: newProduct.sellingPrice,
          description: newProduct.description,
          stock: 0
      }).unwrap();

      setSelectedProductId(createdProduct.id);
      setOpenNewProductDialog(false);
      setNewProduct({
        name: "",
        purchasePrice: 0,
        sellingPrice: 0,
        description: "",
      });
    } catch (error) {
      console.error("Failed to create product:", error);
    }
  };

  const handleSubmit = () => {
    if (!selectedProductId || quantite <= 0) return;

    onSubmit({
      productId: selectedProductId,
      quantite: quantite,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
    });
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <Box sx={style}>
          <Typography variant="h6" mb={2}>
            {initialData ? "Update Daily Product" : "Add Daily Product"}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TextField
              select
              fullWidth
              label="Product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              margin="normal"
              required
              disabled={productsLoading}
            >
              {products.map((product) => (
                <MenuItem key={product.id} value={product.id}>
                  {product.name} - {product.sellingPrice} DT
                </MenuItem>
              ))}
            </TextField>

            <IconButton
              sx={{
                backgroundColor: "primary.main",
                color: "white",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
                borderRadius: "50%",
                width: 30,
                height: 30,
                mt: 2,
              }}
              onClick={() => setOpenNewProductDialog(true)}
            >
              <AddIcon />
            </IconButton>
          </Box>

          <TextField
            fullWidth
            label="Quantity"
            type="number"
            value={quantite}
            onChange={(e) => setQuantite(Number(e.target.value))}
            margin="normal"
            required
            inputProps={{ min: 1 }}
          />

         

          <Stack direction="row" spacing={2} mt={3} justifyContent="flex-end">
            <Button variant="outlined" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!selectedProductId || quantite <= 0}
            >
              {initialData ? "Update" : "Add"}
            </Button>
          </Stack>
        </Box>
      </Modal>

      <Dialog
        open={openNewProductDialog}
        onClose={() => setOpenNewProductDialog(false)}
      >
        <DialogTitle>Create a new product</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Product Name"
            fullWidth
            value={newProduct.name}
            onChange={(e) =>
              setNewProduct({ ...newProduct, name: e.target.value })
            }
            required
            error={errors.name}
            helperText={errors.name ? "Name is required" : ""}
          />
          <TextField
            margin="dense"
            label="Purchase Price (DT)"
            type="number"
            fullWidth
            value={newProduct.purchasePrice}
            onChange={(e) =>
              setNewProduct({ ...newProduct, purchasePrice: Number(e.target.value) })
            }
            required
            error={errors.purchasePrice}
            helperText={errors.purchasePrice ? "Must be greater than 0" : ""}
            inputProps={{ min: 0.01, step: 0.01 }}
          />
          <TextField
            margin="dense"
            label="Selling Price (DT)"
            type="number"
            fullWidth
            value={newProduct.sellingPrice}
            onChange={(e) =>
              setNewProduct({ ...newProduct, sellingPrice: Number(e.target.value) })
            }
            required
            error={errors.sellingPrice}
            helperText={errors.sellingPrice ? "Must be greater than 0" : ""}
            inputProps={{ min: 0.01, step: 0.01 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProduct.description}
            onChange={(e) =>
              setNewProduct({ ...newProduct, description: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewProductDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateNewProduct}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}