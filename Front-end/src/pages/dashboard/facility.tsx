import React, { ReactElement, useState, useEffect } from 'react';
import { Facility, useGetFacilityByIdQuery, useUpdateFacilityMutation } from 'src/api/facility.repo';
import {
  Box,
  Tab,
  Tabs,
  Typography,
  TextField,
  Button,
  Divider,
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
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Place as AddressIcon,
  AddAPhoto as AddAPhotoIcon,
  Edit as EditIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import RoleProtectedRoute from 'src/components/auth/ProtectedRoute';
import DashboardLayout from "../../layouts/Dashboard";

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
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

interface Place {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
}

const FacilityProfile = () => {
  const facilityId = 'a69401f8-df5d-46cc-959d-026293d00114';
  const { data: facility, isLoading } = useGetFacilityByIdQuery(facilityId);
  const [updateFacility] = useUpdateFacilityMutation();
  const [value, setValue] = useState(0);
  const [formData, setFormData] = useState<Partial<Facility>>({});
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [newPlace, setNewPlace] = useState<Place>({ id: '', name: '', description: '', capacity: 0 });
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
    setFormData(prev => ({
      ...prev,
      [name]: name === 'nbrPlaces' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setSocialLinks(prev => ({ ...prev, [platform]: value }));
  };

  const handlePlaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingPlace(prev => prev ? { ...prev, [name]: name === 'capacity' ? parseInt(value) || 0 : value } : prev);
  };

  const handleNewPlaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewPlace(prev => ({ ...prev, [name]: name === 'capacity' ? parseInt(value) || 0 : value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      // Ici vous devez implémenter le vrai upload vers votre backend
      // Pour l'exemple, nous utilisons une simulation qui retourne une data URL
      const uploadedLogoUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });

      // Mettre à jour le backend
      await updateFacility({
        id: facilityId,
        data: {
          logo: uploadedLogoUrl,
        },
      }).unwrap();

      // Mettre à jour le state local
      setFormData(prev => ({
        ...prev,
        logo: uploadedLogoUrl,
      }));

    } catch (error) {
      console.error('Failed to upload logo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFacility({
        id: facilityId,
        data: {
          ...formData,
          socialNetworks: socialLinks,
        },
      }).unwrap();
    } catch (error) {
      console.error('Failed to update facility:', error);
    }
  };

  const handlePlaceSubmit = async (placeId: string) => {
    if (!editingPlace) return;
    try {
      const updatedPlaces = {
        ...facility?.places,
        [placeId]: editingPlace,
      };
      await updateFacility({
        id: facilityId,
        data: {
          places: updatedPlaces,
        },
      }).unwrap();
      setEditingPlace(null);
    } catch (error) {
      console.error('Failed to update place:', error);
    }
  };

  const handleAddPlace = async () => {
    if (!newPlace.name) return;
    try {
      const newPlaceId = crypto.randomUUID();
      const updatedPlaces = {
        ...facility?.places,
        [newPlaceId]: { ...newPlace, id: newPlaceId },
      };
      await updateFacility({
        id: facilityId,
        data: {
          places: updatedPlaces,
        },
      }).unwrap();
      setNewPlace({ id: '', name: '', description: '', capacity: 0 });
      setOpenAddDialog(false);
    } catch (error) {
      console.error('Failed to add place:', error);
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    try {
      const updatedPlaces = { ...facility?.places };
      delete updatedPlaces[placeId];
      await updateFacility({
        id: facilityId,
        data: {
          places: updatedPlaces,
        },
      }).unwrap();
    } catch (error) {
      console.error('Failed to delete place:', error);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!facility) return <div>Facility not found</div>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ width: '100%', p: 3 }}>
        <Stack direction="row" spacing={4} alignItems="flex-start">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 200,
              position: 'sticky',
              top: 230,
              mt: 3,
              backgroundColor: 'background.paper',
              borderRadius: 2,
              zIndex: 1,
              padding: 7,
            }}
          >
            <Avatar
              src={formData.logo || '/default-logo.png'}
              sx={{
                width: 150,

                height: 150,
                border: '3px solid',
                borderColor: 'primary.main',
                boxShadow: 3,
                mb: 2, // Margin-bottom to create space between avatar and button
              }}
            />
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="logo-upload"
                type="file"
                onChange={handleLogoUpload}
                disabled={isUploading}
              />
              <label htmlFor="logo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={isUploading ? <CircularProgress size={20} /> : <AddAPhotoIcon />}
                  sx={{
                    width: '100%',
                    mb: 1,
                  }}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
              </label>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                textAlign: 'center',
              }}
            >
              {/* Add any caption text here if needed */}
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
                position: 'relative',
              }}
            >
              Facility Profile
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={value} onChange={handleChange} aria-label="facility tabs">
                <Tab label="General" {...a11yProps(0)} />
                <Tab label="Places" {...a11yProps(1)} />
                <Tab label="Social Networks" {...a11yProps(2)} />
              </Tabs>
            </Box>

            <form onSubmit={handleSubmit}>
              <TabPanel value={value} index={0}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Basic Information</Typography>
                    <TextField
                      fullWidth
                      label="Name"
                      name="name"
                      value={formData.name ?? ''}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="numtel"
                      value={formData.numtel ?? ''}
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
                      value={formData.email ?? ''}
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
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Location</Typography>
                    <TextField
                      fullWidth
                      label="Address"
                      name="adresse"
                      value={formData.adresse ?? ''}
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
                      label="Number of Places"
                      name="nbrPlaces"
                      type="number"
                      value={formData.nbrPlaces ?? ''}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </Grid>
                </Grid>
                <Box mt={4} display="flex" justifyContent="flex-start">
                  <IconButton color="error">
                    <DeleteIcon />
                    <Typography ml={1}>Delete Facility</Typography>
                  </IconButton>
                </Box>
              </TabPanel>

              <TabPanel value={value} index={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" gutterBottom>Places Configuration</Typography>
                  <IconButton
                    color="primary"
                    onClick={() => setOpenAddDialog(true)}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={3}>
                  {Object.entries(facility.places || {}).map(([placeId, place]: [string, any]) => (
                    <Grid item xs={12} sm={6} md={4} key={placeId}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          {editingPlace?.id === placeId ? (
                            <>
                              <TextField
                                fullWidth
                                label="Place Name"
                                name="name"
                                value={editingPlace.name}
                                onChange={handlePlaceChange}
                                margin="normal"
                                variant="outlined"
                              />
                              <TextField
                                fullWidth
                                label="Description"
                                name="description"
                                value={editingPlace.description || ''}
                                onChange={handlePlaceChange}
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
                                value={editingPlace.capacity || ''}
                                onChange={handlePlaceChange}
                                margin="normal"
                                variant="outlined"
                              />
                            </>
                          ) : (
                            <>
                              <Typography variant="h6">{place.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {place.description || 'No description'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" mt={1}>
                                Capacity: {place.capacity || 'N/A'}
                              </Typography>
                            </>
                          )}
                        </CardContent>
                        <CardActions>
                          {editingPlace?.id === placeId ? (
                            <>
                              <Button
                                size="small"
                                onClick={() => handlePlaceSubmit(placeId)}
                                color="primary"
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                onClick={() => setEditingPlace(null)}
                                color="secondary"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => setEditingPlace({ id: placeId, ...place })}
                              >

                              </Button>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeletePlace(placeId)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
                  <DialogTitle>Add New Place</DialogTitle>
                  <DialogContent>
                    <TextField
                      fullWidth
                      label="Place Name"
                      name="name"
                      value={newPlace.name}
                      onChange={handleNewPlaceChange}
                      margin="normal"
                      variant="outlined"
                      required
                    />
                    <TextField
                      fullWidth
                      label="Description"
                      name="description"
                      value={newPlace.description}
                      onChange={handleNewPlaceChange}
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
                      value={newPlace.capacity}
                      onChange={handleNewPlaceChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setOpenAddDialog(false)} color="secondary">
                      Cancel
                    </Button>
                    <Button onClick={handleAddPlace} color="primary" disabled={!newPlace.name}>
                      Add
                    </Button>
                  </DialogActions>
                </Dialog>
              </TabPanel>

              <TabPanel value={value} index={2}>
                <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>Social Networks</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Facebook"
                      value={socialLinks.facebook || ''}
                      onChange={(e) => handleSocialLinkChange('facebook', e.target.value)}
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
                      value={socialLinks.instagram || ''}
                      onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
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
                      value={socialLinks.linkedin || ''}
                      onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
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
                      value={socialLinks.twitter || ''}
                      onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
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

              <Box mt={4} display="flex" justifyContent="flex-end" sx={{ pr: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  sx={{
                    px: 4,
                    minWidth: '200px',
                  }}
                >
                  Save Changes
                </Button>
              </Box>
            </form>
          </Box>
        </Stack>
      </Paper>
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