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

interface Space {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  image?: string;
}

const FacilityProfile = () => {
  const facilityId = 'a69401f8-df5d-46cc-959d-026293d00114';
  const { data: facility, isLoading } = useGetFacilityByIdQuery(facilityId);
  const [updateFacility] = useUpdateFacilityMutation();
  const [value, setValue] = useState(0);
  const [formData, setFormData] = useState<Partial<Facility>>({});
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [newSpace, setNewSpace] = useState<Space>({ id: '', name: '', description: '', capacity: 0, image: '' });
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
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

  const handleSpaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingSpace(prev => prev ? { ...prev, [name]: name === 'capacity' ? parseInt(value) || 0 : value } : prev);
  };

  const handleNewSpaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSpace(prev => ({ ...prev, [name]: name === 'capacity' ? parseInt(value) || 0 : value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isNewSpace: boolean) => {
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
        setNewSpace(prev => ({ ...prev, image: uploadedImageUrl }));
      } else if (editingSpace) {
        setEditingSpace(prev => prev ? { ...prev, image: uploadedImageUrl } : prev);
      }

    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        id: facilityId,
        data: {
          logo: uploadedLogoUrl,
        },
      }).unwrap();

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

  const handleSpaceSubmit = async () => {
    if (!editingSpace) return;
    try {
      const updatedSpaces = {
        ...facility?.places,
        [editingSpace.id]: editingSpace,
      };
      await updateFacility({
        id: facilityId,
        data: {
          places: updatedSpaces,
        },
      }).unwrap();
      setEditingSpace(null);
      setOpenEditDialog(false);
    } catch (error) {
      console.error('Failed to update space:', error);
    }
  };

  const handleAddSpace = async () => {
    if (!newSpace.name) return;
    try {
      const newSpaceId = crypto.randomUUID();
      const updatedSpaces = {
        ...facility?.places,
        [newSpaceId]: { ...newSpace, id: newSpaceId },
      };
      await updateFacility({
        id: facilityId,
        data: {
          places: updatedSpaces,
        },
      }).unwrap();
      setNewSpace({ id: '', name: '', description: '', capacity: 0, image: '' });
      setOpenAddDialog(false);
    } catch (error) {
      console.error('Failed to add space:', error);
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    try {
      const updatedSpaces = { ...facility?.places };
      delete updatedSpaces[spaceId];
      await updateFacility({
        id: facilityId,
        data: {
          places: updatedSpaces,
        },
      }).unwrap();
    } catch (error) {
      console.error('Failed to delete space:', error);
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
                mb: 2,
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
                <Tab label="Spaces" {...a11yProps(1)} />
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
                      label="Number of Spaces"
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
                  <Typography variant="h6" gutterBottom>Spaces Configuration</Typography>
                  <IconButton
                    color="primary"
                    onClick={() => setOpenAddDialog(true)}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={3}>
                  {Object.entries(facility.places || {}).map(([spaceId, space]: [string, any]) => (
                    <Grid item xs={12} sm={6} md={4} key={spaceId}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Avatar
                          src={space.image || '/default-space.png'}
                          sx={{
                            width: '100%',
                            height: 150,
                            borderRadius: '4px 4px 0 0',
                            objectFit: 'cover'
                          }}
                          variant="square"
                        />
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="h6">{space.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {space.description || 'No description'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" mt={1}>
                            Capacity: {space.capacity || 'N/A'}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => {
                              setEditingSpace({ id: spaceId, ...space });
                              setOpenEditDialog(true);
                            }}
                          >

                          </Button>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSpace(spaceId)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
                  <DialogTitle>Add New Space</DialogTitle>
                  <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      <Avatar
                        src={newSpace.image || '/default-space.png'}
                        sx={{ width: 100, height: 100 }}
                      />
                    </Box>
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="space-image-upload"
                        type="file"
                        onChange={(e) => handleImageUpload(e, true)}
                        disabled={isUploading}
                      />
                      <label htmlFor="space-image-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={isUploading ? <CircularProgress size={20} /> : <AddAPhotoIcon />}
                          disabled={isUploading}
                        >
                          {isUploading ? 'Uploading...' : 'Upload Space Image'}
                        </Button>
                      </label>
                    </Box>
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
                  <DialogActions>
                    <Button onClick={() => setOpenAddDialog(false)} color="secondary">
                      Cancel
                    </Button>
                    <Button onClick={handleAddSpace} color="primary" disabled={!newSpace.name}>
                      Add
                    </Button>
                  </DialogActions>
                </Dialog>

                <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
                  <DialogTitle>Edit Space</DialogTitle>
                  <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      <Avatar
                        src={editingSpace?.image || '/default-space.png'}
                        sx={{ width: 100, height: 100 }}
                      />
                    </Box>
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="edit-space-image-upload"
                        type="file"
                        onChange={(e) => handleImageUpload(e, false)}
                        disabled={isUploading}
                      />
                      <label htmlFor="edit-space-image-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={isUploading ? <CircularProgress size={20} /> : <AddAPhotoIcon />}
                          disabled={isUploading}
                        >
                          {isUploading ? 'Uploading...' : 'Upload Space Image'}
                        </Button>
                      </label>
                    </Box>
                    <TextField
                      fullWidth
                      label="Space Name"
                      name="name"
                      value={editingSpace?.name || ''}
                      onChange={handleSpaceChange}
                      margin="normal"
                      variant="outlined"
                      required
                    />
                    <TextField
                      fullWidth
                      label="Description"
                      name="description"
                      value={editingSpace?.description || ''}
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
                      value={editingSpace?.capacity || ''}
                      onChange={handleSpaceChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setOpenEditDialog(false)} color="secondary">
                      Cancel
                    </Button>
                    <Button onClick={handleSpaceSubmit} color="primary" disabled={!editingSpace?.name}>
                      Save
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