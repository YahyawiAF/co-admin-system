import React, { ReactElement, useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import { toast } from 'react-toastify';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import RoleProtectedRoute from 'src/components/auth/ProtectedRoute';
import DashboardLayout from '../../layouts/Dashboard';

// Interface pour une chaise avec des détails professionnels
interface Chair {
  id: string;
  name: string;
  status: 'available' | 'reserved';
  lastModified: string;
  x: number;
  y: number;
  description: string;
  reservedBy?: string;
  zone: 'open_space' | 'reading_room' | 'meeting_room';
}

// Interface pour les données de l'API
interface SpaceData {
  chairs: Chair[];
}

// Données par défaut réalistes avec plus de chaises et positions organiques
const defaultChairs: Chair[] = [
  // Zone Open Space (12 chaises, positions organiques)
  { id: 'chair-1', name: 'OS-A1', status: 'available', lastModified: new Date().toISOString(), x: 180, y: 120, description: 'Chaise ergonomique, bureau partagé', zone: 'open_space' },
  { id: 'chair-2', name: 'OS-A2', status: 'reserved', lastModified: new Date().toISOString(), x: 240, y: 140, description: 'Chaise ergonomique, proche fenêtre', zone: 'open_space', reservedBy: 'Sophie Martin' },
  { id: 'chair-3', name: 'OS-A3', status: 'available', lastModified: new Date().toISOString(), x: 300, y: 160, description: 'Chaise standard, éclairage LED', zone: 'open_space' },
  { id: 'chair-4', name: 'OS-A4', status: 'available', lastModified: new Date().toISOString(), x: 360, y: 130, description: 'Chaise ergonomique, coin collaboratif', zone: 'open_space' },
  { id: 'chair-5', name: 'OS-B1', status: 'reserved', lastModified: new Date().toISOString(), x: 200, y: 220, description: 'Chaise premium, bureau flexible', zone: 'open_space', reservedBy: 'Lucas Dubois' },
  { id: 'chair-6', name: 'OS-B2', status: 'available', lastModified: new Date().toISOString(), x: 260, y: 240, description: 'Chaise standard, proche café', zone: 'open_space' },
  { id: 'chair-7', name: 'OS-B3', status: 'available', lastModified: new Date().toISOString(), x: 320, y: 260, description: 'Chaise ergonomique, espace ouvert', zone: 'open_space' },
  { id: 'chair-8', name: 'OS-B4', status: 'reserved', lastModified: new Date().toISOString(), x: 380, y: 230, description: 'Chaise premium, vue extérieure', zone: 'open_space', reservedBy: 'Emma Laurent' },
  { id: 'chair-9', name: 'OS-C1', status: 'available', lastModified: new Date().toISOString(), x: 220, y: 300, description: 'Chaise standard, coin calme', zone: 'open_space' },
  { id: 'chair-10', name: 'OS-C2', status: 'reserved', lastModified: new Date().toISOString(), x: 280, y: 320, description: 'Chaise ergonomique, bureau partagé', zone: 'open_space', reservedBy: 'Paul Renault' },
  { id: 'chair-11', name: 'OS-C3', status: 'available', lastModified: new Date().toISOString(), x: 340, y: 340, description: 'Chaise premium, proche sortie', zone: 'open_space' },
  { id: 'chair-12', name: 'OS-C4', status: 'available', lastModified: new Date().toISOString(), x: 400, y: 310, description: 'Chaise standard, espace collaboratif', zone: 'open_space' },

  // Zone Salle de Lecture (8 chaises, positions organiques)
  { id: 'chair-13', name: 'RR-D1', status: 'reserved', lastModified: new Date().toISOString(), x: 620, y: 120, description: 'Chaise confortable, coin lecture silencieux', zone: 'reading_room', reservedBy: 'Marc Lefèvre' },
  { id: 'chair-14', name: 'RR-D2', status: 'available', lastModified: new Date().toISOString(), x: 680, y: 140, description: 'Chaise rembourrée, éclairage doux', zone: 'reading_room' },
  { id: 'chair-15', name: 'RR-D3', status: 'available', lastModified: new Date().toISOString(), x: 740, y: 160, description: 'Chaise ergonomique, table individuelle', zone: 'reading_room' },
  { id: 'chair-16', name: 'RR-D4', status: 'reserved', lastModified: new Date().toISOString(), x: 800, y: 130, description: 'Chaise premium, espace calme', zone: 'reading_room', reservedBy: 'Claire Moreau' },
  { id: 'chair-17', name: 'RR-E1', status: 'available', lastModified: new Date().toISOString(), x: 640, y: 220, description: 'Chaise standard, coin lecture', zone: 'reading_room' },
  { id: 'chair-18', name: 'RR-E2', status: 'available', lastModified: new Date().toISOString(), x: 700, y: 240, description: 'Chaise rembourrée, proche étagère', zone: 'reading_room' },
  { id: 'chair-19', name: 'RR-E3', status: 'reserved', lastModified: new Date().toISOString(), x: 760, y: 260, description: 'Chaise confortable, vue jardin', zone: 'reading_room', reservedBy: 'Anna Dubois' },
  { id: 'chair-20', name: 'RR-E4', status: 'available', lastModified: new Date().toISOString(), x: 820, y: 230, description: 'Chaise ergonomique, espace isolé', zone: 'reading_room' },

  // Zone Salle de Réunion (8 chaises, positions organiques)
  { id: 'chair-21', name: 'MR-F1', status: 'available', lastModified: new Date().toISOString(), x: 620, y: 340, description: 'Chaise de conférence, salle équipée', zone: 'meeting_room' },
  { id: 'chair-22', name: 'MR-F2', status: 'available', lastModified: new Date().toISOString(), x: 680, y: 360, description: 'Chaise de conférence, écran 4K', zone: 'meeting_room' },
  { id: 'chair-23', name: 'MR-F3', status: 'reserved', lastModified: new Date().toISOString(), x: 740, y: 380, description: 'Chaise confortable, salle de réunion', zone: 'meeting_room', reservedBy: 'Team Alpha' },
  { id: 'chair-24', name: 'MR-F4', status: 'available', lastModified: new Date().toISOString(), x: 800, y: 350, description: 'Chaise de conférence, Wi-Fi haut débit', zone: 'meeting_room' },
  { id: 'chair-25', name: 'MR-G1', status: 'reserved', lastModified: new Date().toISOString(), x: 640, y: 440, description: 'Chaise premium, salle équipée', zone: 'meeting_room', reservedBy: 'Team Beta' },
  { id: 'chair-26', name: 'MR-G2', status: 'available', lastModified: new Date().toISOString(), x: 700, y: 460, description: 'Chaise standard, proche projecteur', zone: 'meeting_room' },
  { id: 'chair-27', name: 'MR-G3', status: 'available', lastModified: new Date().toISOString(), x: 760, y: 480, description: 'Chaise de conférence, espace réunion', zone: 'meeting_room' },
  { id: 'chair-28', name: 'MR-G4', status: 'available', lastModified: new Date().toISOString(), x: 820, y: 450, description: 'Chaise ergonomique, coin réunion', zone: 'meeting_room' },
];

interface CoworkingSpaceMapProps {
  getLayout: (page: ReactElement) => ReactElement;
}

const CoworkingSpaceMap: React.FC & CoworkingSpaceMapProps = () => {
  const [chairs, setChairs] = useState<Chair[]>(defaultChairs);
  const [filter, setFilter] = useState<'all' | 'available' | 'reserved' | 'open_space' | 'reading_room' | 'meeting_room'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Récupérer les données des chaises depuis l'API
  const fetchChairs = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.sitemap.io/coworking-chairs', {
        headers: {
          Authorization: 'Bearer VOTRE_TOKEN_ICI',
        },
      });
      const data: SpaceData = await response.json();
      if (data.chairs && data.chairs.length > 0) {
        const chairsWithPositions = data.chairs.map((chair, index) => ({
          ...chair,
          x: chair.x ?? 180 + (index % 5) * 60 + (Math.random() * 20 - 10),
          y: chair.y ?? 120 + Math.floor(index / 5) * 80 + (Math.random() * 20 - 10),
          zone: chair.zone ?? 'open_space',
        }));
        setChairs(chairsWithPositions);
      } else {
        setChairs(defaultChairs);
        toast.warn('Aucune donnée de l’API, affichage des chaises par défaut.');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des chaises:', error);
      toast.error('Erreur lors du chargement des chaises. Affichage par défaut.');
      setChairs(defaultChairs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChairs();
  }, []);

  // Filtrer les chaises selon le statut ou la zone sélectionnée
  const filteredChairs = chairs.filter((chair) => {
    if (filter === 'all') return true;
    if (filter === 'available' || filter === 'reserved') return chair.status === filter;
    return chair.zone === filter;
  });

  // Gérer la réservation d'une chaise
  const handleReserve = async (chairId: string) => {
    try {
      const response = await fetch(`https://api.sitemap.io/coworking-chairs/${chairId}/reserve`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer VOTRE_TOKEN_ICI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'current_user_id' }),
      });
      if (!response.ok) throw new Error('Réservation échouée');

      // Mettre à jour l'état local pour refléter la réservation immédiatement
      setChairs((prevChairs) =>
        prevChairs.map((chair) =>
          chair.id === chairId
            ? { ...chair, status: 'reserved', reservedBy: 'Utilisateur', lastModified: new Date().toISOString() }
            : chair
        )
      );
      toast.success('Chaise réservée avec succès !');
    } catch (error) {
      toast.error('Erreur lors de la réservation.');
    }
  };

  // SVG personnalisé pour une chaise avec un design moderne
  const ChairIcon = ({ status, zone }: { status: 'available' | 'reserved'; zone: string }) => {
    const color = status === 'available' ? '#4caf50' : '#f44336';
    const shape = zone === 'reading_room' ? (
      <path d="M5 4h14v3h2v14h-2v-2h-12v2h-2v-14h2v-3zm2 3v4h10v-4h-10zm-2 6h14v6h-14v-6z" fill={color} />
    ) : zone === 'meeting_room' ? (
      <path d="M5 5h14v2h2v12h-2v2h-14v-2h-2v-12h2v-2zm2 2v4h10v-4h-10zm-2 6h14v4h-14v-4z" fill={color} />
    ) : (
      <path d="M7 3h10v3h3v15h-3v-2h-8v2h-3v-15h3v-3zm2 3v4h6v-4h-6zm-2 6h10v7h-10v-7z" fill={color} />
    );
    return (
      <svg width="36" height="36" viewBox="0 0 24 24">
        {shape}
      </svg>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 6, mb: 6, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ width: '100%', maxWidth: 1200, p: 5, borderRadius: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.5px',
            }}
          >
            Espace de Coworking Professionnel
          </Typography>
          <IconButton onClick={fetchChairs} title="Rafraîchir les données" sx={{ color: 'primary.main' }}>
            <RefreshIcon fontSize="large" />
          </IconButton>
        </Box>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 5, maxWidth: '600px' }}
        >
          Gérez et réservez vos places dans notre espace de coworking moderne, conçu pour la productivité et la collaboration.
        </Typography>

        {/* Filtres */}
        <Box sx={{ display: 'flex', gap: 2, mb: 5, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'available', label: 'Disponibles' },
            { id: 'reserved', label: 'Réservées' },
            { id: 'open_space', label: 'Open Space' },
            { id: 'reading_room', label: 'Salle de Lecture' },
            { id: 'meeting_room', label: 'Salle de Réunion' },
          ].map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? 'contained' : 'outlined'}
              onClick={() => setFilter(f.id as 'all' | 'available' | 'reserved' | 'open_space' | 'reading_room' | 'meeting_room')}
              sx={{
                borderRadius: '50px',
                textTransform: 'none',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
                },
              }}
            >
              {f.label}
            </Button>
          ))}
        </Box>

        {/* Légende */}
        <Box sx={{ display: 'flex', gap: 4, mb: 5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ChairIcon status="available" zone="open_space" />
            <Typography variant="body2" sx={{ ml: 1, fontWeight: 500 }}>Disponible</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ChairIcon status="reserved" zone="open_space" />
            <Typography variant="body2" sx={{ ml: 1, fontWeight: 500 }}>Réservée</Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 5, borderColor: 'grey.200' }} />

        {/* Plan SVG */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
            <CircularProgress size={80} thickness={4} />
          </Box>
        ) : (
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '600px',
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: '16px',
              overflow: 'hidden',
              bgcolor: '#ffffff',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <svg width="100%" height="100%" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
              {/* Fond et structure du plan */}
              <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
              {/* Zone Open Space (gauche) */}
              <rect x="50" y="50" width="450" height="500" fill="#f5f7fa" stroke="#e0e0e0" strokeWidth="2" rx="8" />
              <text x="275" y="40" textAnchor="middle" fontSize="14" fill="#333" fontWeight={600}>Open Space</text>
              {/* Zone Salle de Lecture (haut-droite) */}
              <rect x="550" y="50" width="400" height="250" fill="#e8ecef" stroke="#e0e0e0" strokeWidth="2" rx="8" />
              <text x="750" y="40" textAnchor="middle" fontSize="14" fill="#333" fontWeight={600}>Salle de Lecture</text>
              {/* Zone Salle de Réunion (bas-droite) */}
              <rect x="550" y="320" width="400" height="230" fill="#edf7ed" stroke="#e0e0e0" strokeWidth="2" rx="8" />
              <text x="750" y="310" textAnchor="middle" fontSize="14" fill="#333" fontWeight={600}>Salle de Réunion</text>
              {/* Éléments décoratifs : tables */}
              <rect x="80" y="100" width="390" height="400" fill="none" stroke="#d0d0d0" strokeWidth="1" rx="4" />
              <rect x="580" y="100" width="340" height="160" fill="none" stroke="#d0d0d0" strokeWidth="1" rx="4" />
              <rect x="580" y="360" width="340" height="160" fill="none" stroke="#d0d0d0" strokeWidth="1" rx="4" />
              {filteredChairs.map((chair) => (
                <Tooltip
                  key={chair.id}
                  title={
                    <Box sx={{ p: 1 }}>
                      <Typography variant="body1" fontWeight={600}>{chair.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{chair.description}</Typography>
                      {chair.reservedBy && (
                        <Typography variant="caption" color="text.secondary">Réservée par : {chair.reservedBy}</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Zone : {chair.zone === 'open_space' ? 'Open Space' : chair.zone === 'reading_room' ? 'Salle de Lecture' : 'Salle de Réunion'}
                      </Typography>
                      {chair.status === 'available' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleReserve(chair.id)}
                          sx={{ mt: 1, borderRadius: '20px', textTransform: 'none' }}
                        >
                          Réserver
                        </Button>
                      )}
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <g style={{ cursor: chair.status === 'available' ? 'pointer' : 'default' }}>
                    <foreignObject x={chair.x - 18} y={chair.y - 18} width="36" height="36">
                      <ChairIcon status={chair.status} zone={chair.zone} />
                    </foreignObject>
                    <text
                      x={chair.x}
                      y={chair.y + 28}
                      textAnchor="middle"
                      fill="#333"
                      fontSize="12"
                      fontWeight={500}
                    >
                      {chair.name}
                    </text>
                  </g>
                </Tooltip>
              ))}
            </svg>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

// Ajout du layout et de la protection par rôle
CoworkingSpaceMap.getLayout = function getLayout(page: ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={['ADMIN']}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default CoworkingSpaceMap;