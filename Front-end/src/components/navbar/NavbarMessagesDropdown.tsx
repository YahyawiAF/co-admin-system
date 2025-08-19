import React from "react";
import Link from "next/link";
import { IconButton, Tooltip, Badge } from "@mui/material";
import { MessageSquare } from "react-feather";
import { useSnackbar } from "notistack";
import { useEffect, useState } from "react";
import { initializePusher } from "src/api/pusher.service";

function NavbarMessagesDropdown() {
  const { enqueueSnackbar } = useSnackbar();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // S'exécute uniquement côté client
    if (typeof window !== "undefined") {
      setCurrentUserId(sessionStorage.getItem("userID"));
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return; // Ne pas initialiser Pusher tant qu'on n'a pas l'ID utilisateur
    
    const pusher = initializePusher();
    const channel = pusher.subscribe('chat');

    channel.bind('new-message', (newMsg: any) => {
      // Ne pas afficher de notification si le message vient de l'utilisateur actuel
      if (newMsg.sender?.id === currentUserId) return;
      
      // Show notification
      enqueueSnackbar(`New message from ${newMsg.sender?.fullname || 'Someone'}`, {
        variant: 'info',
        anchorOrigin: {
          vertical: 'top',
          horizontal: 'right',
        },
        autoHideDuration: 5000,
      });
      
      // Increment unread count
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [enqueueSnackbar, currentUserId]);

  const resetUnreadCount = () => {
    setUnreadCount(0);
  };

  return (
    <Tooltip title="Messages">
      <Link href="/dashboard/messages" passHref>
        <IconButton 
          color="inherit" 
          size="large"
          onClick={resetUnreadCount}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary'
            }
          }}
        >
          <Badge badgeContent={unreadCount} color="error">
            <MessageSquare />
          </Badge>
        </IconButton>
      </Link>
    </Tooltip>
  );
}

export default NavbarMessagesDropdown;