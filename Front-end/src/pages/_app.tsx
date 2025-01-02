import { useEffect, type ReactNode } from "react";
import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { CacheProvider, EmotionCache } from "@emotion/react";
import { Inter } from "next/font/google";
import "chart.js/auto";

import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

import "../vendor/perfect-scrollbar.css";
import "animate.css/animate.min.css";

import "../i18n";
import createTheme from "../theme";

import { ThemeProvider } from "../contexts/ThemeContext";
import useTheme from "../hooks/useTheme";
import { store } from "../redux/store";

import createEmotionCache from "../utils/createEmotionCache";

import { AuthProvider } from "../contexts/JWTContext";

const inter = Inter({ subsets: ["latin"] });

const clientSideEmotionCache = createEmotionCache();

type GetLayout = (page: ReactNode) => ReactNode;

type Page<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: GetLayout;
};

type MyAppProps<P = {}> = AppProps<P> & {
  emotionCache?: EmotionCache;
  Component: Page<P>;
};

interface AuthInitializerProps {
  children: ReactNode;
}

const AppInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  return children;
};

function App({
  Component,
  emotionCache = clientSideEmotionCache,
  pageProps,
}: MyAppProps) {
  const { theme } = useTheme();
  const getLayout = Component.getLayout ?? ((page: ReactNode) => page);

  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${inter.style.fontFamily};
        }
      `}</style>
      <CacheProvider value={emotionCache}>
        <HelmetProvider>
          <Helmet
            titleTemplate="%s | Mira"
            defaultTitle="Mira - React Material Admin Dashboard"
          />
          <Provider store={store}>
            {/* @ts-ignore */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <MuiThemeProvider theme={createTheme(theme)}>
                <AuthProvider>
                  <AppInitializer>
                    {getLayout(<Component {...pageProps} />)}
                  </AppInitializer>
                </AuthProvider>
              </MuiThemeProvider>
            </LocalizationProvider>
          </Provider>
        </HelmetProvider>
      </CacheProvider>
    </>
  );
}

const withThemeProvider = (Component: any) => {
  const AppWithThemeProvider = (props: JSX.IntrinsicAttributes) => {
    return (
      <ThemeProvider>
        <Component {...props} />
      </ThemeProvider>
    );
  };
  AppWithThemeProvider.displayName = "AppWithThemeProvider";
  return AppWithThemeProvider;
};

export default withThemeProvider(App);
