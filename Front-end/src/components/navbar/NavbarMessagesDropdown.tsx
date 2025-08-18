import React from "react";
import Link from "next/link";
import { IconButton, Tooltip } from "@mui/material";
import { MessageSquare } from "react-feather";

function NavbarMessagesDropdown() {
  return (
    <Tooltip title="Messages">
      <Link href="/dashboard/messages" passHref>
        <IconButton 
          color="inherit" 
          size="large"
          sx={{
            color: 'text.secondary', // Couleur grise du thème
            '&:hover': {
              color: 'text.primary' // Couleur au survol
            }
          }}
        >
          <MessageSquare />
        </IconButton>
      </Link>
    </Tooltip>
  );
}

export default NavbarMessagesDropdown;