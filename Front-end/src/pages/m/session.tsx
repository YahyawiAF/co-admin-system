import { ReactElement, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import MobileLayout from "src/layouts/MobileVisitor";
import {
  useCheckoutSessionMutation,
  useGetMobileStatusQuery,
} from "src/api/mobile.repo";
import { getRealtimeSocket } from "src/utils/adminSocket";

function formatMs(ms: number) {
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function MobileSession() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  useEffect(() => {
    setMemberId(sessionStorage.getItem("memberId"));
  }, []);

  const { data, refetch, isLoading } = useGetMobileStatusQuery(memberId || "", {
    skip: !memberId,
    pollingInterval: 5000,
  });
  const [checkout, { isLoading: checkingOut }] = useCheckoutSessionMutation();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!memberId) return;
    const s = getRealtimeSocket();
    const refresh = (payload?: { memberId?: string }) => {
      if (payload?.memberId && payload.memberId !== memberId) return;
      refetch();
    };
    s.on("visit_request_resolved", refresh);
    s.on("table_updates", refresh);
    s.on("visitor_checkout", refresh);
    return () => {
      s.off("visit_request_resolved", refresh);
      s.off("table_updates", refresh);
      s.off("visitor_checkout", refresh);
    };
  }, [memberId, refetch]);

  const session = data?.session;
  const remainingMs = useMemo(() => {
    if (!session?.expectedLeaveTime) return session?.remainingMs ?? null;
    return new Date(session.expectedLeaveTime).getTime() - now;
  }, [session, now]);

  const overtime = remainingMs !== null && remainingMs < 0;
  const amount = session?.amountDue ?? session?.payedAmount ?? 0;

  const handleCheckout = async () => {
    if (!session?.id) return;
    // Checkout only — payment status stays as-is
    await checkout({ id: session.id }).unwrap();
    refetch();
  };

  if (!memberId) {
    return (
      <Alert severity="warning">
        Non connecté.{" "}
        <Button onClick={() => router.push("/m")}>Accueil</Button>
      </Alert>
    );
  }

  if (isLoading) return <Typography color="text.secondary">Chargement…</Typography>;

  if (!session) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          Aucune session
        </Typography>
        <Typography sx={{ mb: 2, color: "#64748b" }}>
          Démarrez une visite du jour pour afficher le minuteur.
        </Typography>
        <Button
          variant="contained"
          disableElevation
          sx={{ bgcolor: "#1976d2", textTransform: "none", borderRadius: 2 }}
          onClick={() =>
            router.push({ pathname: "/m/choose", query: { mode: "day" } })
          }
        >
          Choisir un forfait
        </Button>
      </Box>
    );
  }

  return (
    <Box textAlign="center">
      <Typography variant="overline" sx={{ color: "#64748b" }}>
        Session en cours
      </Typography>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        {session.prices?.name || "Forfait"}
      </Typography>
      <Chip
        label={session.isPayed ? "Payé" : "Non payé"}
        color={session.isPayed ? "success" : "warning"}
        sx={{ fontWeight: 600, mb: 1 }}
      />
      <Box
        sx={{
          my: 3,
          py: 3,
          px: 2,
          bgcolor: "#fff",
          borderRadius: 3,
          border: "1px solid #e2e8f0",
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontWeight: 700,
            color: overtime ? "#d32f2f" : "#1976d2",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {remainingMs === null
            ? "—"
            : overtime
              ? `+${formatMs(remainingMs)}`
              : formatMs(remainingMs)}
        </Typography>
        <Typography sx={{ color: "#64748b", mt: 1 }}>
          {overtime ? "Temps dépassé" : "Temps restant"}
        </Typography>
      </Box>
      {overtime ? (
        <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
          Le prix du forfait reste affiché ; l&apos;accueil peut ajuster.
        </Alert>
      ) : null}
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
        {amount} DT
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#64748b" }}>
        Statut : {session.isPayed ? "payé" : "non payé"}
      </Typography>
      {data?.hasActiveSubscription ? (
        <Alert severity="success" sx={{ mb: 2, textAlign: "left" }}>
          Couvert par abonnement actif.
        </Alert>
      ) : null}
      <Stack spacing={1}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          disableElevation
          disabled={checkingOut || !!session.leaveTime}
          onClick={handleCheckout}
          sx={{
            bgcolor: "#1976d2",
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            py: 1.5,
          }}
        >
          Check-out
        </Button>
        <Button
          sx={{ textTransform: "none", color: "#64748b" }}
          onClick={() => router.push("/m/tarifs")}
        >
          Comment sont calculés les tarifs ?
        </Button>
      </Stack>
    </Box>
  );
}

MobileSession.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileSession;
