import { ReactElement, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import MobileLayout from "src/layouts/MobileVisitor";
import {
  useCancelVisitRequestMutation,
  useCreateVisitRequestMutation,
  useGetMobileStatusQuery,
  useGetMobileTarifsQuery,
  useGetVisitRequestQuery,
} from "src/api/mobile.repo";
import { BillingUnit, PriceCategory, PriceType } from "src/types/shared";
import { getRealtimeSocket } from "src/utils/adminSocket";

function MobileChoose() {
  const router = useRouter();
  const mode = (router.query.mode as string) || "day";
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setMemberId(sessionStorage.getItem("memberId"));
    const stored = sessionStorage.getItem("pendingVisitRequestId");
    if (stored) setPendingId(stored);
  }, []);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    useGetMobileStatusQuery(memberId || "", {
      skip: !memberId,
      pollingInterval: pendingId ? 2000 : 8000,
    });

  const { data: tarifs = [], isLoading } = useGetMobileTarifsQuery();
  const [createRequest, { isLoading: submitting, error }] =
    useCreateVisitRequestMutation();
  const [cancelRequest, { isLoading: cancelling }] =
    useCancelVisitRequestMutation();

  const handleCancelPending = async () => {
    const id = pendingId || status?.pendingRequest?.id;
    if (!id || !memberId) return;
    try {
      await cancelRequest({ id, memberId }).unwrap();
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
      await refetchStatus();
    } catch {
      // keep pending UI; error shown via RTK if needed
    }
  };

  // Realtime: when admin confirms/rejects
  useEffect(() => {
    if (!memberId) return;
    const s = getRealtimeSocket();
    const onResolved = (payload: {
      memberId?: string;
      status?: string;
      type?: string;
    }) => {
      if (payload?.memberId && payload.memberId !== memberId) return;
      if (
        payload?.status === "REJECTED" ||
        payload?.status === "CANCELLED"
      ) {
        sessionStorage.removeItem("pendingVisitRequestId");
        setPendingId(null);
        refetchStatus();
        return;
      }
      if (payload?.status && payload.status !== "APPROVED") return;
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
      refetchStatus().then((res) => {
        if (payload?.type === "SUBSCRIPTION" || res.data?.subscription) {
          router.replace("/m/subscription");
        } else {
          router.replace("/m/session");
        }
      });
    };
    s.on("visit_request_resolved", onResolved);
    return () => {
      s.off("visit_request_resolved", onResolved);
    };
  }, [memberId, refetchStatus, router]);

  // Sync pending request from server if phone lost sessionStorage
  useEffect(() => {
    if (status?.pendingRequest?.id) {
      const id = status.pendingRequest.id;
      sessionStorage.setItem("pendingVisitRequestId", id);
      setPendingId(id);
    }
  }, [status?.pendingRequest?.id]);

  // Block choosing another day pack when session already open
  useEffect(() => {
    if (mode === "day" && status?.session && !status?.pendingRequest) {
      router.replace("/m/session");
    }
  }, [mode, status?.session, status?.pendingRequest, router]);

  const { data: pendingRequest } = useGetVisitRequestQuery(pendingId || "", {
    skip: !pendingId,
    pollingInterval: pendingId ? 3000 : 0,
  });

  useEffect(() => {
    if (!pendingRequest) return;
    if (pendingRequest.status === "APPROVED") {
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
      router.push(
        pendingRequest.type === "SUBSCRIPTION" ? "/m/subscription" : "/m/session"
      );
    }
    if (pendingRequest.status === "REJECTED") {
      sessionStorage.removeItem("pendingVisitRequestId");
      setPendingId(null);
    }
  }, [pendingRequest, router]);

  const options = useMemo(() => {
    if (mode === "subscription") {
      return tarifs.filter(
        (t) =>
          t.category === PriceCategory.ABONNEMENT ||
          t.type === PriceType.abonnement
      );
    }
    return tarifs.filter(
      (t) =>
        t.category === PriceCategory.JOURNEE ||
        (t.type === PriceType.journal &&
          t.billingUnit !== BillingUnit.HOURLY &&
          t.category !== PriceCategory.SALLE &&
          t.category !== PriceCategory.OPEN_SPACE)
    );
  }, [tarifs, mode]);

  const blockedByOpenSession = mode === "day" && !!status?.session;
  const blockedByPending = !!status?.pendingRequest || !!pendingId;

  const pick = async (priceId: string) => {
    if (!memberId) {
      router.push("/m/signup");
      return;
    }
    if (mode === "day" && status?.session) {
      router.replace("/m/session");
      return;
    }
    if (status?.pendingRequest || pendingId) {
      return;
    }
    try {
      const req = await createRequest({
        memberId,
        priceId,
        type: mode === "subscription" ? "SUBSCRIPTION" : "DAY",
      }).unwrap();
      sessionStorage.setItem("pendingVisitRequestId", req.id);
      setPendingId(req.id);
    } catch {
      // RTK error shown below
    }
  };

  if (!memberId) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Session expirée.{" "}
        <Button onClick={() => router.push("/m")}>Recommencer</Button>
      </Alert>
    );
  }

  if (statusLoading && !status) {
    return (
      <Box textAlign="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (blockedByOpenSession && mode === "day") {
    return (
      <Box textAlign="center" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ mb: 2, textAlign: "left" }}>
          Vous avez déjà une session en cours. Terminez-la (check-out) avant
          d&apos;en démarrer une autre.
        </Alert>
        <Button
          variant="contained"
          disableElevation
          sx={{ bgcolor: "#1976d2", textTransform: "none" }}
          onClick={() => router.push("/m/session")}
        >
          Voir ma session
        </Button>
      </Box>
    );
  }

  if (pendingId || status?.pendingRequest) {
    const rejected = pendingRequest?.status === "REJECTED";
    return (
      <Box textAlign="center" sx={{ py: 6 }}>
        {rejected ? (
          <>
            <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
              Demande refusée. Choisissez un autre forfait.
            </Alert>
            <Button
              variant="contained"
              disableElevation
              sx={{ bgcolor: "#1976d2", textTransform: "none" }}
              onClick={() => {
                sessionStorage.removeItem("pendingVisitRequestId");
                setPendingId(null);
              }}
            >
              Réessayer
            </Button>
          </>
        ) : (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              En attente de confirmation
            </Typography>
            <Typography sx={{ color: "#64748b", mb: 3 }}>
              L&apos;accueil a reçu votre demande. Vous pouvez annuler pour
              choisir un autre forfait.
            </Typography>
            <Button
              variant="outlined"
              disabled={cancelling}
              onClick={handleCancelPending}
              sx={{ textTransform: "none" }}
            >
              {cancelling ? <CircularProgress size={18} /> : "Annuler ma demande"}
            </Button>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
        {mode === "subscription" ? "Abonnement" : "Forfait"}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2.5, color: "#64748b" }}>
        L&apos;accueil confirmera pour démarrer.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as any)?.data?.message || "Erreur"}
        </Alert>
      )}
      {isLoading ? (
        <Typography color="text.secondary">Chargement…</Typography>
      ) : (
        <Stack spacing={1.25}>
          {options.map((o) => (
            <Box
              key={o.id}
              component="button"
              disabled={submitting || blockedByOpenSession || blockedByPending}
              onClick={() => pick(o.id)}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                textAlign: "left",
                border: "1px solid #e2e8f0",
                bgcolor: "#fff",
                borderRadius: 2,
                px: 2,
                py: 1.75,
                cursor: "pointer",
                "&:hover": { borderColor: "#90caf9", bgcolor: "#f8fbff" },
                "&:disabled": { opacity: 0.6, cursor: "not-allowed" },
              }}
            >
              <Box>
                <Typography fontWeight={600} color="#0f172a">
                  {o.name}
                </Typography>
                <Typography variant="body2" color="#64748b">
                  {o.durationHours
                    ? `${o.durationHours}h`
                    : o.periodDays
                      ? `${o.periodDays} jours`
                      : ""}
                </Typography>
              </Box>
              <Typography fontWeight={700} color="#1976d2">
                {o.price} DT
              </Typography>
            </Box>
          ))}
          {!options.length ? (
            <Alert severity="info">Aucun tarif disponible.</Alert>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}

MobileChoose.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileChoose;
