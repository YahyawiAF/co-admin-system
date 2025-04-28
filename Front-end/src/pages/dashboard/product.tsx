import React, { useState, ChangeEvent, ReactElement } from "react";
import {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from "src/api/productApi"; // Import des hooks de l'API
import { Product } from "src/types/shared"; // Import du modèle Product
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
  Checkbox,
  CircularProgress,
  Alert,
  TableSortLabel,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import DashboardLayout from "../../layouts/Dashboard";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BulkActions from "src/components/Table/members/TableHeader"; // Composant pour les actions groupées
import { EnhancedTableHeadProps, HeadCell } from "src/types/table";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

// Styles personnalisés pour la mise en page
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
  "& .MuiTableCell-head:last-child": {
    textAlign: "center",
    paddingRight: theme.spacing(3),
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
    "&:nth-of-type(1)": { width: "25%" },
    "&:nth-of-type(2)": { width: "20%" },
    "&:nth-of-type(3)": { width: "20%" },
    "&:nth-of-type(4)": { width: "20%" },
    "&:nth-of-type(5)": { width: "15%" },
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

// En-tête du tableau avec tri
const EnhancedTableHead: React.FC<EnhancedTableHeadProps> = ({
  onSelectAllClick,
  order,
  orderBy,
  numSelected,
  rowCount,
  onRequestSort,
  headCells,
  isMobile,
}) => {
  const createSortHandler =
    (property: string) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  return (
    <TableHead>
      <TableRow>
        <ResponsiveTableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            inputProps={{ "aria-label": "select all products" }}
          />
        </ResponsiveTableCell>
        {headCells.map((headCell) => (
          <ResponsiveTableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={{ display: "none" }}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </ResponsiveTableCell>
        ))}
      </TableRow>
    </TableHead>
  );
};

const ProductComponent = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  // Utilisation des hooks de l'API pour récupérer et gérer les produits
  const { data: products, isLoading, isError, refetch } = useGetProductsQuery();
  const [createProduct] = useCreateProductMutation();
  const [updateProduct] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

  // État pour la recherche, le tri, et la sélection
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
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [orderBy, setOrderBy] = useState<string>("name");

  // Définition des colonnes du tableau
  const headCells = [
    {
      id: "name",
      numeric: false,
      disablePadding: false,
      label: "Name",
      alwaysVisible: false,
    },
    {
      id: "description",
      numeric: false,
      disablePadding: false,
      label: "description",
      alwaysVisible: false,
    },
    {
      id: "purchasePrice",
      numeric: false,
      disablePadding: false,
      label: "purchasePrice",
      alwaysVisible: !isMobile,
    },
    {
      id: "sellingPrice",
      numeric: false,
      disablePadding: false,
      label: "sellingPrice",
      alwaysVisible: !isMobile,
    },
    {
      id: "stock",
      numeric: false,
      disablePadding: false,
      label: "stock",
      alwaysVisible: !isMobile,
    },

    {
      id: "actions",
      numeric: false,
      disablePadding: false,
      label: "Actions",
      alwaysVisible: false,
    },
  ];

  // Gestion de la sélection de tous les éléments
  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && filteredProducts) {
      const newSelected = filteredProducts.map((product) => product.id);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  // Gestion de la sélection individuelle
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

  // Gestion du tri
  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: string
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  // Validation du formulaire
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

  // Ajout d'un produit
  const handleAddProduct = async () => {
    setErrors({});
    if (validateForm()) {
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
        setSelected([]);
      } catch (error) {
        console.error("Error adding product:", error);
      }
    }
  };

  // Fermeture du drawer
  const handleCloseDrawer = () => {
    setShowDrawer(false);
    setEditProduct(null);
    setErrors({});
  };

  // Mise à jour d'un produit
  const handleUpdateProduct = async () => {
    setErrors({});
    if (editProduct && validateForm()) {
      try {
        const { id, createdAt, updatedAt, ...data } = editProduct;
        await updateProduct({ id, data }).unwrap();
        setEditProduct(null);
        setShowDrawer(false);
        setSelected([]);
      } catch (error) {
        console.error("Error updating product:", error);
      }
    }
  };

  // Confirmation de suppression
  const confirmDeleteProduct = (id: string) => {
    setProductToDelete(id);
    setShowDeleteModal(true);
  };

  // Suppression d'un produit
  const handleConfirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete);
      setShowDeleteModal(false);
      setProductToDelete(null);
      setSelected(selected.filter((id) => id !== productToDelete));
    }
  };

  // Filtrage des produits basé sur la recherche
  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Gestion de la recherche
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Affichage de l'état de chargement
  if (isLoading)
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );

  // Affichage des erreurs
  if (isError) return <Alert severity="error">Error loading products</Alert>;

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Product Management
      </Typography>

      <MainContainer>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid
            item
            xs={12}
            sm={12}
            md={12}
            sx={{ display: "flex", justifyContent: "flex-end" }}
          >
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

        <TableWrapper>
          <StyledTableContainer>
            <Table stickyHeader aria-label="products table">
              <EnhancedTableHead
                numSelected={selected.length}
                order={order}
                orderBy={orderBy}
                onSelectAllClick={handleSelectAllClick}
                onRequestSort={handleRequestSort}
                rowCount={filteredProducts?.length || 0}
                headCells={headCells}
                isMobile={isMobile}
              />
              <TableBody>
                {filteredProducts?.map((product) => {
                  const isItemSelected = isSelected(product.id);
                  return (
                    <TableRow
                      key={product.id}
                      hover
                      onClick={(event) => handleClick(event, product.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      selected={isItemSelected}
                    >
                      <ResponsiveTableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isItemSelected}
                          inputProps={{ "aria-labelledby": product.id }}
                        />
                      </ResponsiveTableCell>
                      <ResponsiveTableCell>{product.name}</ResponsiveTableCell>
                      <ResponsiveTableCell>
                        {product.description}{" "}
                      </ResponsiveTableCell>

                      <ResponsiveTableCell>
                        {product.purchasePrice} DT
                      </ResponsiveTableCell>
                      <ResponsiveTableCell>
                        {product.sellingPrice} DT
                      </ResponsiveTableCell>

                      {!isMobile && (
                        <ResponsiveTableCell>
                          {product.stock}
                        </ResponsiveTableCell>
                      )}
                      <ResponsiveTableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditProduct(product);
                              setShowDrawer(true);
                            }}
                            size="small"
                            color="primary"
                          >
                            <EditIcon
                              fontSize={isMobile ? "small" : "medium"}
                            />
                          </IconButton>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteProduct(product.id);
                            }}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon
                              fontSize={isMobile ? "small" : "medium"}
                            />
                          </IconButton>
                        </Box>
                      </ResponsiveTableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </TableWrapper>
      </MainContainer>

      {/* Modal de confirmation de suppression */}
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
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer pour ajouter/modifier un produit */}
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
          {editProduct ? "Manage Product" : "New Product"}
        </Typography>

        <TextField
          label="Name"
          fullWidth
          value={editProduct ? editProduct.name : newProduct.name}
          onChange={(e) =>
            editProduct
              ? setEditProduct({ ...editProduct, name: e.target.value })
              : setNewProduct({ ...newProduct, name: e.target.value })
          }
          error={!!errors.name}
          helperText={errors.name}
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

        <TextField
          label="Purchase Price (DT)"
          fullWidth
          type="number"
          value={
            editProduct ? editProduct.purchasePrice : newProduct.purchasePrice
          }
          onChange={(e) => {
            const value = Math.max(0, +e.target.value);
            editProduct
              ? setEditProduct({ ...editProduct, purchasePrice: value })
              : setNewProduct({ ...newProduct, purchasePrice: value });
          }}
          error={!!errors.purchasePrice}
          helperText={errors.purchasePrice}
        />

        <TextField
          label="Selling Price (DT)"
          fullWidth
          type="number"
          value={
            editProduct ? editProduct.sellingPrice : newProduct.sellingPrice
          }
          onChange={(e) => {
            const value = Math.max(0, +e.target.value);
            editProduct
              ? setEditProduct({ ...editProduct, sellingPrice: value })
              : setNewProduct({ ...newProduct, sellingPrice: value });
          }}
          error={!!errors.sellingPrice}
          helperText={errors.sellingPrice}
        />

        <TextField
          label="Stock"
          fullWidth
          type="number"
          value={editProduct ? editProduct.stock : newProduct.stock}
          onChange={(e) => {
            const value = Math.max(0, +e.target.value);
            editProduct
              ? setEditProduct({ ...editProduct, stock: value })
              : setNewProduct({ ...newProduct, stock: value });
          }}
          error={!!errors.stock}
          helperText={errors.stock}
        />

        <TextField
          label="Image URL"
          fullWidth
          value={editProduct ? editProduct.img : newProduct.img}
          onChange={(e) =>
            editProduct
              ? setEditProduct({ ...editProduct, img: e.target.value })
              : setNewProduct({ ...newProduct, img: e.target.value })
          }
        />

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
          >
            {editProduct ? "Update" : "Create"}
          </SubmitButton>
        </Box>
      </Drawer>
    </PageContainer>
  );
};

// Layout avec protection de rôle
ProductComponent.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default ProductComponent;
