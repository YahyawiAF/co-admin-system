import { Tab, styled } from "@mui/material";
import React from "react";

// -------------------------------------------------------

interface LinkTabProps {
  label?: string;
  href?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  title?: string;
}

const CustomTab = styled(Tab)(
  () => `
    min-width: 200px; 
    width: 200px;
    // &.Mui-selected {
    //     background-color: #FFF;
    //     color: #223354;
    // } 
    `
);

export function LinkTab(props: LinkTabProps) {
  return (
    <CustomTab
      disableRipple
      disableFocusRipple
      onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.preventDefault();
      }}
      {...props}
    />
  );
}

export function TabPanel(props: TabPanelProps) {
  const { children, title, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <>{children}</>}
    </div>
  );
}

export function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}
