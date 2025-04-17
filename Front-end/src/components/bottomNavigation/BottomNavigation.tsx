import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArchiveIcon from "@mui/icons-material/Archive";
import Paper from "@mui/material/Paper";
import React, { useEffect, useState } from "react";
import QrCodeIcon from '@mui/icons-material/QrCode';

export default function FixedBottomNavigation() {
  const [value, setValue] = useState(0);

  // Met à jour `value` selon le chemin actuel
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/client/account")) {
      setValue(0);
    } else if (path.includes("/client/sub")) {
      setValue(1);
    } else if (path.includes("/client/archive")) {
      setValue(2);
    } else {
      setValue(-1); // Aucun onglet sélectionné
    }
  }, []);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
    if (newValue === 0) {
      window.location.href = "/client/account";
    } else if (newValue === 1) {
      window.location.href = "/client/sub";
    } else if (newValue === 2) {
      window.location.href = "/client/archive";
    }
  };

  return (
    <Paper sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }} elevation={3}>
      <BottomNavigation showLabels value={value} onChange={handleChange}>
        <BottomNavigationAction label="Profil" icon={<AccountCircleIcon />} />
        <BottomNavigationAction label="Subscription" icon={<QrCodeIcon />} />
        <BottomNavigationAction label="Archive" icon={<ArchiveIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
