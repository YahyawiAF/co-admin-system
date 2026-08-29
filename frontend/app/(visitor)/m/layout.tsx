import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: "Collabora Hub",
  appleWebApp: {
    capable: true,
    title: "Collabora",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function MobileRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
