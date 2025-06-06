import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import FastfoodIcon from "@mui/icons-material/Fastfood";
import FeedbackIcon from "@mui/icons-material/Feedback";
import Paper from "@mui/material/Paper";
import React, { useEffect, useState } from "react";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

export default function FixedBottomNavigation() {
  const [value, setValue] = useState(0);

  // Update `value` based on the current path
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/client/sub")) {
      setValue(0);
    } else if (path.includes("/client/snacks")) {
      setValue(1);
    } else if (path.includes("/client/claims")) {
      setValue(2);
    } else if (path.includes("/client/account")) {
      setValue(3);
    } else {
      setValue(-1); // No tab selected
    }
  }, []);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
    if (newValue === 0) {
      window.location.href = "/client/sub";
    } else if (newValue === 1) {
      window.location.href = "/client/snacks";
    } else if (newValue === 2) {
      window.location.href = "/client/claims";
    } else if (newValue === 3) {
      window.location.href = "/client/account";
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
        <BottomNavigationAction label="Settings" icon={<AccountCircleIcon />} />
      </BottomNavigation>
    </Paper>
  );
}