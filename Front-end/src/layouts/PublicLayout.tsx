import React from "react";
import { Outlet } from "react-router-dom";
import styled from "@emotion/styled";
import "../globals.css";

import { CssBaseline, Paper as MuiPaper } from "@mui/material";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { spacing } from "@mui/system";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { THEMES } from "../constants";
import createTheme from "../theme";
import GlobalStyle from "../components/GlobalStyle";
//icons
import FixedBottomNavigation from "src/components/bottomNavigation/BottomNavigation";

const Root = styled.div`
  display: flex;
  min-height: 100vh;
`;

const AppContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const Paper = styled(MuiPaper)(spacing);

const MainContent = styled(Paper)`
  flex: 1;
  background: ${(props) => props.theme.palette.background.default};

  @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {
    flex: none;
  }

  .MuiPaper-root .MuiPaper-root {
    box-shadow: none;
  }
`;

interface PresentationType {
  children?: React.ReactNode;
}

const Presentation: React.FC<PresentationType> = ({ children }) => {
  const [value, setValue] = React.useState(0);

  const theme = useTheme();
  const isLgDown = useMediaQuery(theme.breakpoints.down("lg"));

  return (
    <MuiThemeProvider theme={createTheme(THEMES.DEFAULT)}>
      <Root>
        <CssBaseline />
        <GlobalStyle />
        <AppContent>
          <MainContent>
            {children}
            <Outlet />
          </MainContent>
          <FixedBottomNavigation />
        </AppContent>
      </Root>
    </MuiThemeProvider>
  );
};

export default Presentation;
