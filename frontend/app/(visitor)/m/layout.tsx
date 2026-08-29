import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "Collabora Hub",
};

export default function MobileRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
