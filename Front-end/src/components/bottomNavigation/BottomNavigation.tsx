import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { BottomNavigation, BottomNavigationAction, Badge } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FastfoodIcon from "@mui/icons-material/Fastfood";
import FeedbackIcon from "@mui/icons-material/Feedback";
import ChatIcon from "@mui/icons-material/Chat";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Paper from "@mui/material/Paper";
import { initializePusher } from "src/api/pusher.service";
import { useSnackbar } from "notistack";

export default function FixedBottomNavigation() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [value, setValue] = useState(-1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Initialize as null

  // Access sessionStorage only in the browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userId = sessionStorage.getItem("userID");
      setCurrentUserId(userId);
    }
  }, []);

  // Update `value` based on the current path
  useEffect(() => {
    const path = router.pathname;
    if (path.includes("/client/sub")) {
      setValue(0);
    } else if (path.includes("/client/snacks")) {
      setValue(1);
    } else if (path.includes("/client/claims")) {
      setValue(2);
    } else if (path.includes("/client/messages")) {
      setValue(3);
      setUnreadCount(0); // Reset unread count when on messages page
    } else if (path.includes("/client/account")) {
      setValue(4);
    } else {
      setValue(-1);
    }
  }, [router.pathname]);

  // Pusher setup for notifications
  useEffect(() => {
    const pusher = initializePusher();
    const channel = pusher.subscribe("chat");

    channel.bind("new-message", (newMsg: any) => {
      if (newMsg.sender.id !== currentUserId) {
        // Show notification
        enqueueSnackbar(`New message from ${newMsg.sender?.fullname || "Someone"}`, {
          variant: "info",
          anchorOrigin: {
            vertical: "top",
            horizontal: "right",
          },
          autoHideDuration: 5000,
        });

        // Increment unread count
        setUnreadCount((prev) => prev + 1);
      }
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [enqueueSnackbar, currentUserId]);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
    if (newValue === 0) {
      router.push("/client/sub");
    } else if (newValue === 1) {
      router.push("/client/snacks");
    } else if (newValue === 2) {
      router.push("/client/claims");
    } else if (newValue === 3) {
      router.push("/client/messages");
      setUnreadCount(0); // Reset unread count when navigating to messages
    } else if (newValue === 4) {
      router.push("/client/account");
    }
  };

  return (
    <Paper
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
      elevation={3}
    >
      <BottomNavigation showLabels value={value} onChange={handleChange}>
        <BottomNavigationAction label="Booking" icon={<CalendarMonthIcon />} />
        <BottomNavigationAction label="Snacks" icon={<FastfoodIcon />} />
        <BottomNavigationAction label="Claims" icon={<FeedbackIcon />} />
        <BottomNavigationAction
          label="Chat"
          icon={
            <Badge badgeContent={unreadCount} color="error">
              <ChatIcon />
            </Badge>
          }
        />
        <BottomNavigationAction label="Settings" icon={<AccountCircleIcon />} />
      </BottomNavigation>
    </Paper>
  );
}