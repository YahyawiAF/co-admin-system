import { ReactNode } from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper,
} from "@mui/material";
import { useRouter } from "next/router";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import HistoryIcon from "@mui/icons-material/History";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const MobileLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const path = router.pathname;

  let nav = 0;
  if (path.startsWith("/m/history")) nav = 1;
  else if (path.startsWith("/m/subscription")) nav = 2;
  else if (path.startsWith("/m/tarifs")) nav = 3;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f7fb",
        color: "#1a202c",
        pb: 10,
        maxWidth: 480,
        mx: "auto",
      }}
    >
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>{children}</Box>
      <Paper
        elevation={0}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: "1px solid #e2e8f0",
          maxWidth: 480,
          mx: "auto",
        }}
      >
        <BottomNavigation
          showLabels
          value={nav}
          onChange={(_, v) => {
            if (v === 0) router.push("/m/session");
            if (v === 1) router.push("/m/history");
            if (v === 2) router.push("/m/subscription");
            if (v === 3) router.push("/m/tarifs");
          }}
          sx={{
            bgcolor: "#fff",
            height: 64,
            "& .Mui-selected": { color: "#1976d2" },
            color: "#64748b",
            "& .MuiBottomNavigationAction-label": { fontSize: 11 },
          }}
        >
          <BottomNavigationAction label="Session" icon={<AccessTimeIcon />} />
          <BottomNavigationAction label="Historique" icon={<HistoryIcon />} />
          <BottomNavigationAction
            label="Abonnement"
            icon={<CardMembershipIcon />}
          />
          <BottomNavigationAction label="Tarifs" icon={<InfoOutlinedIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default MobileLayout;
