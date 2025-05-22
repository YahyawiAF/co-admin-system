import React, { ReactElement, useState, useEffect } from "react";
import {
  useGetFirstFacilityQuery,
  useCreateFacilityMutation,
  useUpdateFacilityMutation,
} from "src/api/facility.repo";
import {
  Box,
  Tab,
  Tabs,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  Paper,
  InputAdornment,
  Container,
  Stack,
  Avatar,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Place as AddressIcon,
  Edit as EditIcon,
  Add as AddIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  MeetingRoom as MeetingRoomIcon, // Added for default space icon
} from "@mui/icons-material";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";
import DashboardLayout from "../../layouts/Dashboard";
import { Facility } from "src/types/shared";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

interface Space {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  image?: string;
}

const FacilityProfile = () => {
  const {
    data: facility,
    isLoading,
    isError,
    refetch,
  } = useGetFirstFacilityQuery();
  const [createFacility] = useCreateFacilityMutation();
  const [updateFacility] = useUpdateFacilityMutation();

  const [value, setValue] = useState(0);
  const [formData, setFormData] = useState<Partial<Facility>>({});
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [newSpace, setNewSpace] = useState<Space>({
    id: "",
    name: "",
    description: "",
    capacity: 0,
    image: "",
  });
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "info" | "warning",
  });

  // Refs for file inputs
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const newSpaceInputRef = React.useRef<HTMLInputElement>(null);
  const editSpaceInputRef = React.useRef<HTMLInputElement>(null);

  // Handle automatic facility creation if none exists
  useEffect(() => {
    if (isError) {
      createFacility()
        .unwrap()
        .then(() => {
          refetch();
          setSnackbar({
            open: true,
            message: "New facility created automatically",
            severity: "success",
          });
        })
        .catch((error) => {
          setSnackbar({
            open: true,
            message: "Failed to create facility: " + error.message,
            severity: "error",
          });
        });
    }
  }, [isError, createFacility, refetch]);

  // Initialize formData when facility is loaded
  useEffect(() => {
    if (facility) {
      setFormData({
        name: facility.name,
        numtel: facility.numtel,
        email: facility.email,
        adresse: facility.adresse,
        nbrPlaces: facility.nbrPlaces,
        logo: facility.logo || null,
      });
      setSocialLinks(facility.socialNetworks || {});
    }
  }, [facility]);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "nbrPlaces" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setSocialLinks((prev) => ({ ...prev, [platform]: value }));
  };

  const handleSpaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingSpace((prev) =>
      prev
        ? {
            ...prev,
            [name]: name === "capacity" ? parseInt(value) || 0 : value,
          }
        : prev
    );
  };

  const handleNewSpaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSpace((prev) => ({
      ...prev,
      [name]: name === "capacity" ? parseInt(value) || 0 : value,
    }));
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isNewSpace: boolean
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const uploadedImageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });

      if (isNewSpace) {
        setNewSpace((prev) => ({ ...prev, image: uploadedImageUrl }));
      } else if (editingSpace) {
        setEditingSpace((prev) =>
          prev ? { ...prev, image: uploadedImageUrl } : prev
        );
      }
    } catch (error) {
      console.error("Failed to upload image:", error);
      setSnackbar({
        open: true,
        message: "Failed to upload image",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!facility) return;

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const uploadedLogoUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });

      await updateFacility({
        id: facility.id,
        data: {
          logo: uploadedLogoUrl,
        },
      }).unwrap();

      setFormData((prev) => ({
        ...prev,
        logo: uploadedLogoUrl,
      }));

      setSnackbar({
        open: true,
        message: "Logo updated successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to upload logo",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility) return;

    try {
      await updateFacility({
        id: facility.id,
        data: {
          ...formData,
          socialNetworks: socialLinks,
        },
      }).unwrap();

      setSnackbar({
        open: true,
        message: "Facility updated successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to update facility",
        severity: "error",
      });
    }
  };

  const handleSpaceSubmit = async () => {
    if (!editingSpace || !facility) return;

    try {
      const updatedSpaces = {
        ...facility.places,
        [editingSpace.id]: editingSpace,
      };

      await updateFacility({
        id: facility.id,
        data: {
          places: updatedSpaces,
        },
      }).unwrap();

      setEditingSpace(null);
      setOpenEditDialog(false);
      setSnackbar({
        open: true,
        message: "Space updated successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to update space",
        severity: "error",
      });
    }
  };

  const handleAddSpace = async () => {
    if (!newSpace.name || !facility) return;

    try {
      const newSpaceId = crypto.randomUUID();
      const updatedSpaces = {
        ...facility.places,
        [newSpaceId]: { ...newSpace, id: newSpaceId },
      };

      await updateFacility({
        id: facility.id,
        data: {
          places: updatedSpaces,
        },
      }).unwrap();

      setNewSpace({
        id: "",
        name: "",
        description: "",
        capacity: 0,
        image: "",
      });
      setOpenAddDialog(false);
      setSnackbar({
        open: true,
        message: "Space added successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to add space",
        severity: "error",
      });
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    if (!facility) return;

    try {
      const updatedSpaces = { ...facility.places };
      delete updatedSpaces[spaceId];

      await updateFacility({
        id: facility.id,
        data: {
          places: updatedSpaces,
        },
      }).unwrap();

      setSnackbar({
        open: true,
        message: "Space deleted successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to delete space",
        severity: "error",
      });
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!facility) return <div>Initializing facility...</div>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ width: "100%", p: 3 }}>
        <Stack direction="row" spacing={4} alignItems="flex-start">
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 200,
              position: "sticky",
              top: 240,
              mt: 3,
              backgroundColor: "background.paper",
              borderRadius: 2,
              zIndex: 1,
              padding: 7,
            }}
          >
            {formData.logo ? (
              <Avatar
                src={formData.logo}
                sx={{
                  width: 150,
                  height: 150,
                  border: "3px solid",
                  borderColor: "primary.main",
                  boxShadow: 3,
                  mb: 2,
                  cursor: isUploading ? "default" : "pointer",
                  opacity: isUploading ? 0.6 : 1,
                  transition: "opacity 0.2s ease-in-out",
                  "&:hover": {
                    opacity: isUploading ? 0.6 : 0.8,
                  },
                }}
                onClick={() => !isUploading && logoInputRef.current?.click()}
              />
            ) : (
              <Avatar
                sx={{
                  width: 150,
                  height: 150,
                  border: "3px solid",
                  borderColor: "primary.main",
                  boxShadow: 3,
                  mb: 2,
                  cursor: isUploading ? "default" : "pointer",
                  opacity: isUploading ? 0.6 : 1,
                  transition: "opacity 0.2s ease-in-out",
                  "&:hover": {
                    opacity: isUploading ? 0.6 : 0.8,
                  },
                  bgcolor: "primary.main",
                }}
                onClick={() => !isUploading && logoInputRef.current?.click()}
              >
                <BusinessIcon sx={{ fontSize: 60 }} />
              </Avatar>
            )}
            <input
              accept="image/*"
              style={{ display: "none" }}
              id="logo-upload"
              type="file"
              ref={logoInputRef}
              onChange={handleLogoUpload}
              disabled={isUploading}
            />
            {isUploading && (
              <CircularProgress
                size={30}
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                textAlign: "center",
              }}
            >
              Click image to upload logo
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{
                mb: 3,
                ml: -65,
                pl: 20,
                position: "relative",
              }}
            >
              Facility Profile
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs
                value={value}
                onChange={handleChange}
                aria-label="facility tabs"
              >
                <Tab label="General" {...a11yProps(0)} />
                <Tab label="Spaces" {...a11yProps(1)} />
                <Tab label="Social Networks" {...a11yProps(2)} />
              </Tabs>
            </Box>

            <form onSubmit={handleSubmit}>
              <TabPanel value={value} index={0}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Basic Information
                    </Typography>
                    <TextField
                      fullWidth
                      label="Name"
                      name="name"
                      value={formData.name ?? ""}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="numtel"
                      value={formData.numtel ?? ""}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      value={formData.email ?? ""}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Location
                    </Typography>
                    <TextField
                      fullWidth
                      label="Address"
                      name="adresse"
                      value={formData.adresse ?? ""}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AddressIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Number of Spaces"
                      name="nbrPlaces"
                      type="number"
                      value={formData.nbrPlaces ?? ""}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </Grid>
                </Grid>
                <Box mt={4} display="flex" justifyContent="flex-start">
                  {/* <Box mt={4} display="flex" justifyContent="flex-start">
  <Button
    startIcon={<DeleteIcon />}
    color="error"
    variant="outlined"
    sx={{
      borderRadius: "50px",
      textTransform: "none",
      fontWeight: 500,
      px: 3,
      py: 1,
      borderColor: (theme) => theme.palette.error.main,
      color: (theme) => theme.palette.error.main,
      "&:hover": {
        backgroundColor: (theme) => theme.palette.error.light,
        borderColor: (theme) => theme.palette.error.main,
        transform: "translateY(-1px)",
        boxShadow: "0 2px 6px rgba(244, 67, 54, 0.2)",
      },
      transition: "all 0.2s ease-in-out",
    }}
  >
    Delete Facility
  </Button>
</Box> */}
                </Box>
              </TabPanel>

              <TabPanel value={value} index={1}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 3,
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Spaces Configuration
                  </Typography>
                  <IconButton
                    color="primary"
                    onClick={() => setOpenAddDialog(true)}
                    sx={{
                      backgroundColor: "primary.main",
                      color: "white",
                      borderRadius: "px",
                      width: 26,
                      height: 26,
                      "&:hover": {
                        backgroundColor: "primary.dark",
                        boxShadow: "none",
                      },
                      "& .MuiSvgIcon-root": {
                        fontSize: "1.2rem",
                      },
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={3}>
                  {Object.entries(facility.places || {}).map(
                    ([spaceId, space]: [string, any]) => (
                      <Grid item xs={12} sm={6} md={4} key={spaceId}>
                        <Card
                          sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: "12px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            transition: "transform 0.3s, box-shadow 0.3s",
                            "&:hover": {
                              transform: "translateY(-4px)",
                              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              height: 180,
                              position: "relative",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: space.image ? "transparent" : "grey.200",
                            }}
                          >
                            {space.image ? (
                              <img
                                src={space.image}
                                alt={space.name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  transition: "transform 0.3s",
                                }}
                              />
                            ) : (
                              <Avatar
                                sx={{
                                  width: 80,
                                  height: 80,
                                  bgcolor: "primary.main",
                                }}
                              >
                                <MeetingRoomIcon sx={{ fontSize: 40 }} />
                              </Avatar>
                            )}
                          </Box>
                          <CardContent sx={{ flexGrow: 1, p: 3 }}>
                            <Typography
                              variant="h6"
                              sx={{
                                mb: 1,
                                fontWeight: 600,
                                color: "text.primary",
                              }}
                            >
                              {space.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 2,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minHeight: "40px",
                              }}
                            >
                              {space.description || "No description provided"}
                            </Typography>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                backgroundColor: "rgba(0, 0, 0, 0.04)",
                                borderRadius: "6px",
                                p: "6px 12px",
                                width: "fit-content",
                              }}
                            >
                              <PeopleIcon
                                fontSize="small"
                                sx={{ mr: 1, color: "text.secondary" }}
                              />
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Capacity: {space.capacity || "N/A"}
                              </Typography>
                            </Box>
                          </CardContent>
                          <CardActions
                            sx={{ p: 2, justifyContent: "flex-end" }}
                          >
                            <IconButton
                              onClick={() => {
                                setEditingSpace({ id: spaceId, ...space });
                                setOpenEditDialog(true);
                              }}
                              sx={{
                                backgroundColor: "rgba(25, 118, 210, 0.08)",
                                "&:hover": {
                                  backgroundColor: "rgba(25, 118, 210, 0.15)",
                                },
                              }}
                            >
                              <EditIcon fontSize="small" color="primary" />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDeleteSpace(spaceId)}
                              sx={{
                                backgroundColor: "rgba(211, 47, 47, 0.08)",
                                "&:hover": {
                                  backgroundColor: "rgba(211, 47, 47, 0.15)",
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </CardActions>
                        </Card>
                      </Grid>
                    )
                  )}
                </Grid>

                <Dialog
                  open={openAddDialog}
                  onClose={() => setOpenAddDialog(false)}
                >
                  <DialogTitle>Add New Space</DialogTitle>
                  <DialogContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        mb: 2,
                        position: "relative",
                      }}
                    >
                      {newSpace.image ? (
                        <Avatar
                          src={newSpace.image}
                          sx={{
                            width: 100,
                            height: 100,
                            cursor: isUploading ? "default" : "pointer",
                            opacity: isUploading ? 0.6 : 1,
                            transition: "opacity 0.2s ease-in-out",
                            "&:hover": {
                              opacity: isUploading ? 0.6 : 0.8,
                            },
                          }}
                          onClick={() =>
                            !isUploading && newSpaceInputRef.current?.click()
                          }
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 100,
                            height: 100,
                            cursor: isUploading ? "default" : "pointer",
                            opacity: isUploading ? 0.6 : 1,
                            transition: "opacity 0.2s ease-in-out",
                            "&:hover": {
                              opacity: isUploading ? 0.6 : 0.8,
                            },
                            bgcolor: "primary.main",
                          }}
                          onClick={() =>
                            !isUploading && newSpaceInputRef.current?.click()
                          }
                        >
                          <MeetingRoomIcon sx={{ fontSize: 40 }} />
                        </Avatar>
                      )}
                      {isUploading && (
                        <CircularProgress
                          size={30}
                          sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      )}
                    </Box>
                    <input
                      accept="image/*"
                      style={{ display: "none" }}
                      id="space-image-upload"
                      type="file"
                      ref={newSpaceInputRef}
                      onChange={(e) => handleImageUpload(e, true)}
                      disabled={isUploading}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", textAlign: "center", mb: 2 }}
                    >
                      Click image to upload
                    </Typography>
                    <TextField
                      fullWidth
                      label="Space Name"
                      name="name"
                      value={newSpace.name}
                      onChange={handleNewSpaceChange}
                      margin="normal"
                      variant="outlined"
                      required
                    />
                    <TextField
                      fullWidth
                      label="Description"
                      name="description"
                      value={newSpace.description}
                      onChange={handleNewSpaceChange}
                      margin="normal"
                      variant="outlined"
                      multiline
                      rows={3}
                    />
                    <TextField
                      fullWidth
                      label="Capacity"
                      name="capacity"
                      type="number"
                      value={newSpace.capacity}
                      onChange={handleNewSpaceChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </DialogContent>
                  <DialogActions sx={{ pt: 2 }}>
                    <Button
                      onClick={() => setOpenAddDialog(false)}
                      color="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddSpace}
                      color="primary"
                      disabled={!newSpace.name}
                    >
                      Add Space
                    </Button>
                  </DialogActions>
                </Dialog>

                <Dialog
                  open={openEditDialog}
                  onClose={() => setOpenEditDialog(false)}
                >
                  <DialogTitle>Edit Space</DialogTitle>
                  <DialogContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        mb: 2,
                        position: "relative",
                      }}
                    >
                      {editingSpace?.image ? (
                        <Avatar
                          src={editingSpace.image}
                          sx={{
                            width: 100,
                            height: 100,
                            cursor: isUploading ? "default" : "pointer",
                            opacity: isUploading ? 0.6 : 1,
                            transition: "opacity 0.2s ease-in-out",
                            "&:hover": {
                              opacity: isUploading ? 0.6 : 0.8,
                            },
                          }}
                          onClick={() =>
                            !isUploading && editSpaceInputRef.current?.click()
                          }
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 100,
                            height: 100,
                            cursor: isUploading ? "default" : "pointer",
                            opacity: isUploading ? 0.6 : 1,
                            transition: "opacity 0.2s ease-in-out",
                            "&:hover": {
                              opacity: isUploading ? 0.6 : 0.8,
                            },
                            bgcolor: "primary.main",
                          }}
                          onClick={() =>
                            !isUploading && editSpaceInputRef.current?.click()
                          }
                        >
                          <MeetingRoomIcon sx={{ fontSize: 40 }} />
                        </Avatar>
                      )}
                      {isUploading && (
                        <CircularProgress
                          size={30}
                          sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      )}
                    </Box>
                    <input
                      accept="image/*"
                      style={{ display: "none" }}
                      id="edit-space-image-upload"
                      type="file"
                      ref={editSpaceInputRef}
                      onChange={(e) => handleImageUpload(e, false)}
                      disabled={isUploading}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", textAlign: "center", mb: 2 }}
                    >
                      Click image to upload
                    </Typography>
                    <TextField
                      fullWidth
                      label="Space Name"
                      name="name"
                      value={editingSpace?.name || ""}
                      onChange={handleSpaceChange}
                      margin="normal"
                      variant="outlined"
                      required
                    />
                    <TextField
                      fullWidth
                      label="Description"
                      name="description"
                      value={editingSpace?.description || ""}
                      onChange={handleSpaceChange}
                      margin="normal"
                      variant="outlined"
                      multiline
                      rows={3}
                    />
                    <TextField
                      fullWidth
                      label="Capacity"
                      name="capacity"
                      type="number"
                      value={editingSpace?.capacity || ""}
                      onChange={handleSpaceChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </DialogContent>
                  <DialogActions sx={{ pt: 2 }}>
                    <Button
                      onClick={() => setOpenEditDialog(false)}
                      color="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSpaceSubmit}
                      color="primary"
                      disabled={!editingSpace?.name}
                    >
                      Save Changes
                    </Button>
                  </DialogActions>
                </Dialog>
              </TabPanel>

              <TabPanel value={value} index={2}>
                <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                  Social Networks
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Facebook"
                      value={socialLinks.facebook || ""}
                      onChange={(e) =>
                        handleSocialLinkChange("facebook", e.target.value)
                      }
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <FacebookIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Instagram"
                      value={socialLinks.instagram || ""}
                      onChange={(e) =>
                        handleSocialLinkChange("instagram", e.target.value)
                      }
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <InstagramIcon color="secondary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="LinkedIn"
                      value={socialLinks.linkedin || ""}
                      onChange={(e) =>
                        handleSocialLinkChange("linkedin", e.target.value)
                      }
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkedInIcon color="info" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Twitter"
                      value={socialLinks.twitter || ""}
                      onChange={(e) =>
                        handleSocialLinkChange("twitter", e.target.value)
                      }
                      margin="normal"
                      variant="outlined"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <TwitterIcon color="info" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </TabPanel>

              <Box
                mt={4}
                display="flex"
                justifyContent="flex-end"
                sx={{ pr: 2 }}
              >
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="medium"
                  sx={{
                    px: 3,
                    minWidth: "120px",
                    borderRadius: "50px",
                    textTransform: "none",
                    fontWeight: 600,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  Save Changes
                </Button>
              </Box>
            </form>
          </Box>
        </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

FacilityProfile.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default FacilityProfile;
