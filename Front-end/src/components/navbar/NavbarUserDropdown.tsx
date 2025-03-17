import React from "react";
import styled from "@emotion/styled";
import { Power } from "react-feather";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";  // Make sure dispatch is imported
import { signOut } from "src/redux/authSlice"; // Update path accordingly

import {
  Tooltip,
  Menu,
  MenuItem,
  IconButton as MuiIconButton,
} from "@mui/material";

const IconButton = styled(MuiIconButton)`
  svg {
    width: 22px;
    height: 22px;
  }
`;

function NavbarUserDropdown() {
  const [anchorMenu, setAnchorMenu] = React.useState<any>(null);
  const router = useRouter();
  const dispatch = useDispatch();  // Initialize dispatch here

  const toggleMenu = (event: React.SyntheticEvent) => {
    setAnchorMenu(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorMenu(null);
  };

  const handleSignOut = async () => {
    // Effacer les données de session
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("authToken");
  
    // Afficher dans la console pour vérifier que les tokens sont bien supprimés
    console.log("Auth token removed:", !localStorage.getItem("authToken"));
    console.log("Session token removed:", !sessionStorage.getItem("authToken"));
  
    // Dispatcher l'action signOut pour réinitialiser l'état Redux
    dispatch(signOut());
  
    // Optionnellement, rediriger vers la page de connexion
    router.push("/auth/sign-in");
  };
  

  return (
    <React.Fragment>
      <Tooltip title="Account">
        <IconButton
          aria-owns={Boolean(anchorMenu) ? "menu-appbar" : undefined}
          aria-haspopup="true"
          onClick={toggleMenu}
          color="inherit"
          size="large"
        >
          <Power />
        </IconButton>
      </Tooltip>
      <Menu
        id="menu-appbar"
        anchorEl={anchorMenu}
        open={Boolean(anchorMenu)}
        onClose={closeMenu}
      >
        <MenuItem onClick={closeMenu}>Profile</MenuItem>
        <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
      </Menu>
    </React.Fragment>
  );
}

export default NavbarUserDropdown;
