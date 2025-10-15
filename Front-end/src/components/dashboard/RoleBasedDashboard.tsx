import React from "react";
import { Grid, Card, CardContent, Typography, Box, Chip } from "@mui/material";
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Message as MessageIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { useAuth } from "src/hooks/useAuth";
import { Role } from "src/types/shared";

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  value?: string | number;
  roles: Role[];
  color: string;
  onClick?: () => void;
}

const RoleBasedDashboard: React.FC = () => {
  const { user } = useAuth();

  const dashboardCards: DashboardCard[] = [
    {
      id: "users",
      title: "User Management",
      description: "Manage system users and their roles",
      icon: <PeopleIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      color: "#1976d2",
    },
    {
      id: "members",
      title: "Members",
      description: "Manage coworking space members",
      icon: <BusinessIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.STAFF],
      color: "#388e3c",
    },
    {
      id: "abonnements",
      title: "Subscriptions",
      description: "Manage member subscriptions",
      icon: <ReceiptIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.STAFF],
      color: "#f57c00",
    },
    {
      id: "journals",
      title: "Daily Journals",
      description: "Track daily member activities",
      icon: <AssessmentIcon />,
      roles: [
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.STAFF,
        Role.MEMBER,
      ],
      color: "#7b1fa2",
    },
    {
      id: "products",
      title: "Products",
      description: "Manage inventory and products",
      icon: <InventoryIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
      color: "#c2185b",
    },
    {
      id: "expenses",
      title: "Expenses",
      description: "Track and manage expenses",
      icon: <ReceiptIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
      color: "#d32f2f",
    },
    {
      id: "reclamations",
      title: "Complaints",
      description: "Handle member complaints and feedback",
      icon: <MessageIcon />,
      roles: [
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.STAFF,
        Role.MEMBER,
      ],
      color: "#f9a825",
    },
    {
      id: "statistics",
      title: "Statistics",
      description: "View analytics and reports",
      icon: <TrendingUpIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
      color: "#455a64",
    },
    {
      id: "settings",
      title: "Settings",
      description: "System configuration and settings",
      icon: <SettingsIcon />,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      color: "#616161",
    },
  ];

  const hasPermission = (card: DashboardCard): boolean => {
    if (!user) return false;
    return card.roles.includes(user.role);
  };

  const visibleCards = dashboardCards.filter(hasPermission);

  const getRoleColor = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN:
        return "#d32f2f";
      case Role.ADMIN:
        return "#7b1fa2";
      case Role.MANAGER:
        return "#1976d2";
      case Role.STAFF:
        return "#f57c00";
      case Role.MEMBER:
        return "#388e3c";
      default:
        return "#616161";
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Coworking Space Admin
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body1" color="text.secondary">
            Logged in as: {user?.fullname}
          </Typography>
          <Chip
            label={user?.role?.replace("_", " ")}
            size="small"
            sx={{
              backgroundColor: getRoleColor(user?.role || Role.MEMBER),
              color: "white",
            }}
          />
        </Box>
      </Box>

      <Grid container spacing={3}>
        {visibleCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={card.id}>
            <Card
              sx={{
                height: "100%",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
              onClick={card.onClick}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: card.color,
                      color: "white",
                      mr: 2,
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Typography variant="h6" component="h2">
                    {card.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
                {card.value && (
                  <Typography variant="h4" sx={{ mt: 2, color: card.color }}>
                    {card.value}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {visibleCards.length === 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            textAlign: "center",
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No dashboard items available for your role
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Contact your administrator to get access to more features
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RoleBasedDashboard;
