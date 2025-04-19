import React from "react";
import styled from "@emotion/styled";
import { Power } from "react-feather";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { signOut } from "src/redux/authSlice"; // Assurez-vous que le chemin est correct

import {
  Tooltip,
  Menu,
  MenuItem,
  IconButton as MuiIconButton,
} from "@mui/material";
import { useLogoutMutation } from "src/api/auth.repo";

const IconButton = styled(MuiIconButton)`
  svg {
    width: 22px;
    height: 22px;
  }
`;

function NavbarUserDropdown() {
  const [anchorMenu, setAnchorMenu] = React.useState<any>(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation(); // Initialisez la mutation de déconnexion

  const toggleMenu = (event: React.SyntheticEvent) => {
    setAnchorMenu(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorMenu(null);
  };

  const handleSignOut = async () => {
    // Récupérez le token depuis sessionStorage
    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      console.error("Aucun token d'accès trouvé.");
      // Redirigez l'utilisateur vers la page de connexion
      router.replace("/auth/sign-in");
      return;
    }

    try {
      // Appel à l'API de déconnexion
      await logout().unwrap();

      // Efface les données de session

      sessionStorage.removeItem("username");
      sessionStorage.removeItem("accessToken"); // Supprimez le token du sessionStorage
      sessionStorage.removeItem("refreshToken"); // Supprimez également le refreshToken si nécessaire

      // Dispatcher l'action de déconnexion
      dispatch(signOut());

      // Redirige l'utilisateur vers la page de connexion
      router.replace("/auth/sign-in");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);

      // Si le token est invalide, forcez la déconnexion côté client
      if (typeof error === "object" && error !== null && "status" in error) {
        const fetchError = error as {
          status: number;
          data: { message: string };
        };
        if (fetchError.status === 401) {
          console.error("Token invalide :", fetchError.data.message);
        }
      }

      // Forcez la déconnexion côté client en cas d'erreur
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      dispatch(signOut());
      router.replace("/auth/sign-in");
    }
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
