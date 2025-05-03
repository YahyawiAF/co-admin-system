import React, { useState, ChangeEvent, ReactElement } from "react";
import {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from "src/api/productApi";
import { Product } from "src/types/shared";
import {
  Button,
  IconButton,
  Paper,
  TextField,
  Drawer,
  styled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
  Box,
  Grid,
  useTheme,
  useMediaQuery,
  Theme,
  CircularProgress,
  Alert,
  Avatar,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import DashboardLayout from "../../layouts/Dashboard";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import BulkActions from "src/components/Table/members/TableHeader";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

// Styles personnalisés
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

const ProductsGrid = styled(Grid)(({ theme }) => ({
  marginTop: theme.spacing(3),
  padding: theme.spacing(1),
}));

const ProductCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s, box-shadow 0.3s',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[6],
  },
}));

const ProductMedia = styled(CardMedia)(({ theme }) => ({
  height: 180,
  backgroundSize: 'contain',
  backgroundColor: theme.palette.grey[100],
  position: 'relative',
}));

const StockChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  fontWeight: 'bold',
}));

const ProductContent = styled(CardContent)(({ theme }) => ({
  flexGrow: 1,
}));

const ProductPrice = styled(Typography)(({ theme }) => ({
  color: theme.palette.success.dark,
  fontWeight: 'bold',
  marginTop: theme.spacing(1),
}));

const ProductCost = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: 'line-through',
  fontSize: '0.875rem',
}));

const ProductProfit = styled(Typography)(({ theme }) => ({
  color: theme.palette.success.main,
  fontSize: '0.875rem',
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

const ProductComponent = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  // API Hooks
  const { data: products, isLoading, isError, refetch } = useGetProductsQuery();
  const [createProduct] = useCreateProductMutation();
  const [updateProduct] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

  // State Management
  const [searchTerm, setSearchTerm] = useState("");
  const [newProduct, setNewProduct] = useState<
    Omit<Product, "id" | "createdAt" | "updatedAt">
  >({
    name: "",
    description: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    img: "",
  });
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isUploading, setIsUploading] = useState(false);

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      // Simulate upload (replace with actual API call)
      const uploadedImageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });

      // Update state
      if (editProduct) {
        setEditProduct({ ...editProduct, img: uploadedImageUrl });
      } else {
        setNewProduct({ ...newProduct, img: uploadedImageUrl });
      }

    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Form Validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!(editProduct ? editProduct.name : newProduct.name))
      errors.name = "Name is required";
    if (
      (editProduct ? editProduct.purchasePrice : newProduct.purchasePrice) <= 0
    )
      errors.purchasePrice = "Purchase price must be greater than 0";
    if ((editProduct ? editProduct.sellingPrice : newProduct.sellingPrice) <= 0)
      errors.sellingPrice = "Selling price must be greater than 0";
    if ((editProduct ? editProduct.stock : newProduct.stock) < 0)
      errors.stock = "Stock cannot be negative";

    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // CRUD Operations
  const handleAddProduct = async () => {
    if (!validateForm()) return;

    try {
      await createProduct(newProduct).unwrap();
      setShowDrawer(false);
      setNewProduct({
        name: "",
        description: "",
        purchasePrice: 0,
        sellingPrice: 0,
        stock: 0,
        img: "",
      });
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editProduct || !validateForm()) return;

    try {
      const { id, createdAt, updatedAt, ...data } = editProduct;
      await updateProduct({ id, data }).unwrap();
      setShowDrawer(false);
      setEditProduct(null);
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const confirmDeleteProduct = (id: string) => {
    setProductToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    try {
      await deleteProduct(productToDelete).unwrap();
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditProduct(null);
    setErrors({});
  };

  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Loading and Error States
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Error loading products</Alert>;
  }

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Product Management
      </Typography>

      <MainContainer>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <BulkActions
              handleClickOpen={() => {
                setNewProduct({
                  name: "",
                  description: "",
                  purchasePrice: 0,
                  sellingPrice: 0,
                  stock: 0,
                  img: "",
                });
                setShowDrawer(true);
              }}
              onHandleSearch={handleSearch}
              search={searchTerm}
              refetch={refetch}
              isMobile={isMobile}
            />
          </Grid>
        </Grid>

        <ProductsGrid container spacing={3}>
          {filteredProducts?.map((product) => (
            <Grid item key={product.id} xs={12} sm={6} md={4} lg={3}>
              <ProductCard>
                <ProductMedia
                  image={product.img || "/default-product.png"}
                  title={product.name}
                >
                  <StockChip
                    label={`Stock: ${product.stock}`}
                    color={product.stock > 10 ? "success" : product.stock > 0 ? "warning" : "error"}
                    size="small"
                  />
                </ProductMedia>
                <ProductContent>
                  <Typography gutterBottom variant="h6" component="h3">
                    {product.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    mb: 1
                  }}>
                    {product.description}
                  </Typography>
                  <ProductPrice variant="h6">
                    {product.sellingPrice.toFixed(2)} DT
                  </ProductPrice>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <ProductCost variant="body2">
                      {product.purchasePrice.toFixed(2)} DT
                    </ProductCost>
                    <ProductProfit variant="body2">
                      ({(product.sellingPrice - product.purchasePrice).toFixed(2)} DT profit)
                    </ProductProfit>
                  </Box>
                </ProductContent>
                <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                  <IconButton
                    onClick={() => {
                      setEditProduct(product);
                      setShowDrawer(true);
                    }}
                    size="small"
                    color="primary"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => confirmDeleteProduct(product.id)}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </ProductCard>
            </Grid>
          ))}
        </ProductsGrid>
      </MainContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        fullScreen={isMobile}
      >
        <DialogTitle>Delete Product</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this product? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDeleteProduct} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Product Form Drawer */}
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
          {editProduct ? "Manage Product" : "Manage Product"}
        </Typography>

        {/* Image Upload Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Avatar
            src={editProduct?.img || newProduct.img || "/default-product.png"}
            sx={{
              width: 150,
              height: 150,
              border: '2px solid',
              borderColor: 'primary.main',
              mb: 2,
            }}
            variant="rounded"
          />

          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="product-image-upload"
              type="file"
              onChange={handleImageUpload}
              disabled={isUploading}
            />
            <label htmlFor="product-image-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={isUploading ? <CircularProgress size={20} /> : <AddAPhotoIcon />}
                sx={{ width: '100%', mb: 1 }}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Image'}
              </Button>
            </label>
            <Typography variant="caption" color="text.secondary">

            </Typography>
          </Box>
        </Box>

        {/* Product Form Fields */}
        <TextField
          label="Product Name"
          fullWidth
          value={editProduct ? editProduct.name : newProduct.name}
          onChange={(e) =>
            editProduct
              ? setEditProduct({ ...editProduct, name: e.target.value })
              : setNewProduct({ ...newProduct, name: e.target.value })
          }
          error={!!errors.name}
          helperText={errors.name}
          required
        />

        <TextField
          label="Description"
          fullWidth
          multiline
          rows={3}
          value={editProduct ? editProduct.description : newProduct.description}
          onChange={(e) =>
            editProduct
              ? setEditProduct({ ...editProduct, description: e.target.value })
              : setNewProduct({ ...newProduct, description: e.target.value })
          }
        />

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField
              label="Purchase Price (DT)"
              fullWidth
              type="number"
              value={
                editProduct ? editProduct.purchasePrice : newProduct.purchasePrice
              }
              onChange={(e) => {
                const value = Math.max(0, parseFloat(e.target.value) || 0);
                editProduct
                  ? setEditProduct({ ...editProduct, purchasePrice: value })
                  : setNewProduct({ ...newProduct, purchasePrice: value });
              }}
              error={!!errors.purchasePrice}
              helperText={errors.purchasePrice}
              required
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Selling Price (DT)"
              fullWidth
              type="number"
              value={
                editProduct ? editProduct.sellingPrice : newProduct.sellingPrice
              }
              onChange={(e) => {
                const value = Math.max(0, parseFloat(e.target.value) || 0);
                editProduct
                  ? setEditProduct({ ...editProduct, sellingPrice: value })
                  : setNewProduct({ ...newProduct, sellingPrice: value });
              }}
              error={!!errors.sellingPrice}
              helperText={errors.sellingPrice}
              required
            />
          </Grid>
        </Grid>

        <TextField
          label="Stock Quantity"
          fullWidth
          type="number"
          value={editProduct ? editProduct.stock : newProduct.stock}
          onChange={(e) => {
            const value = Math.max(0, parseInt(e.target.value) || 0);
            editProduct
              ? setEditProduct({ ...editProduct, stock: value })
              : setNewProduct({ ...newProduct, stock: value });
          }}
          error={!!errors.stock}
          helperText={errors.stock}
          required
        />

        {/* Form Actions */}
        <Box
          sx={{
            display: "flex",
            gap: "10px",
            mt: "auto",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <ActionButton onClick={handleCloseDrawer}>Cancel</ActionButton>
          <SubmitButton
            onClick={editProduct ? handleUpdateProduct : handleAddProduct}
            loading={isLoading}
          >
            {editProduct ? "Confirm" : "Confirm"}
          </SubmitButton>
        </Box>
      </Drawer>
    </PageContainer>
  );
};

// Layout with Role Protection
ProductComponent.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default ProductComponent;