"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { format } from "date-fns";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "online",
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const queryKeys = {
  journal: (date: Date | string) =>
    [
      "journal",
      typeof date === "string" ? date : format(date, "yyyy-MM-dd"),
    ] as const,
  members: ["members"] as const,
  prices: ["prices"] as const,
  facility: ["facility"] as const,
  abonnements: ["abonnements"] as const,
  visitRequestsPending: ["visit-requests", "pending"] as const,
  visitArrivals: ["visit-requests", "arrivals"] as const,
  bookingRequestsPending: ["booking-requests", "pending"] as const,
  productOrdersPending: ["product-orders", "pending"] as const,
  adminOrders: (date: string) => ["product-orders", "admin", date] as const,
  groups: ["groups"] as const,
  events: ["events"] as const,
  organization: (slug: string) => ["organization", slug] as const,
  debtors: ["debtors"] as const,
  seatHistory: (date: Date | string) =>
    [
      "seat-history",
      typeof date === "string" ? date : format(date, "yyyy-MM-dd"),
    ] as const,
};
