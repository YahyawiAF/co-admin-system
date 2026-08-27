import { ReactElement, useEffect, useState } from "react";
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
import { loadVisitorCache } from "src/utils/visitorCache";
import {
  useCancelVisitRequestMutation,
  useGetMobileStatusQuery,
} from "src/api/mobile.repo";

function MobileHome() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [hasCache, setHasCache] = useState(false);

  useEffect(() => {
    const cached = loadVisitorCache();
    if (cached?.memberId) {
      sessionStorage.setItem("memberId", cached.memberId);
      if (cached.accessToken) {
        sessionStorage.setItem("memberToken", cached.accessToken);
      }
      if (cached.phone) sessionStorage.setItem("memberPhone", cached.phone);
      setMemberId(cached.memberId);
      setHasCache(true);
    }
  }, []);

  const { data: status, refetch } = useGetMobileStatusQuery(memberId || "", {
    skip: !memberId,
    pollingInterval: 4000,
  });
  const [cancelRequest, { isLoading: cancelling }] =
    useCancelVisitRequestMutation();

  const pending = status?.pendingRequest;

  const goChoose = (mode: "day" | "subscription") => {
    if (!hasCache) {
      router.push({ pathname: "/m/signup", query: { mode } });
      return;
    }
    if (mode === "day" && status?.session) {
      router.push("/m/session");
      return;
    }
    if (pending) {
      sessionStorage.setItem("pendingVisitRequestId", pending.id);
    }
    router.push({ pathname: "/m/choose", query: { mode } });
  };

  const handleCancelPending = async () => {
    if (!pending || !memberId) return;
    await cancelRequest({ id: pending.id, memberId }).unwrap();
    sessionStorage.removeItem("pendingVisitRequestId");
    await refetch();
  };

  return (
    <Box>
      <Typography
        variant="overline"
        sx={{ color: "#1976d2", fontWeight: 700, letterSpacing: 1 }}
      >
        Collabora Hub
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: "#0f172a" }}>
        Bienvenue
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: "#64748b" }}>
        {status?.session
          ? "Vous avez une session en cours."
          : pending
            ? "Demande en attente — vous pouvez annuler et choisir un autre forfait."
            : "Choisissez un forfait du jour ou un abonnement."}
      </Typography>

      {pending ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          En attente de confirmation à l&apos;accueil
          {pending.price?.name ? ` : ${pending.price.name}` : ""}.
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={cancelling}
              onClick={handleCancelPending}
              sx={{ textTransform: "none" }}
            >
              {cancelling ? <CircularProgress size={16} /> : "Annuler"}
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={() =>
                router.push({
                  pathname: "/m/choose",
                  query: {
                    mode:
                      pending.type === "SUBSCRIPTION" ? "subscription" : "day",
                  },
                })
              }
              sx={{ textTransform: "none", bgcolor: "#1976d2" }}
            >
              Voir ma demande
            </Button>
          </Stack>
        </Alert>
      ) : null}

      {status?.session ? (
        <Button
          fullWidth
          size="large"
          variant="contained"
          disableElevation
          sx={{
            bgcolor: "#1976d2",
            py: 1.75,
            textTransform: "none",
            fontWeight: 600,
            fontSize: 16,
            borderRadius: 2,
            mb: 1.5,
          }}
          onClick={() => router.push("/m/session")}
        >
          Voir ma session
        </Button>
      ) : (
        <Stack spacing={1.5}>
          <Button
            fullWidth
            size="large"
            variant="contained"
            disableElevation
            disabled={!!pending}
            sx={{
              bgcolor: "#1976d2",
              py: 1.75,
              textTransform: "none",
              fontWeight: 600,
              fontSize: 16,
              borderRadius: 2,
            }}
            onClick={() => goChoose("day")}
          >
            Choisir un forfait
          </Button>
          <Button
            fullWidth
            size="large"
            variant="outlined"
            disabled={!!pending}
            sx={{
              borderColor: "#cbd5e1",
              color: "#0f172a",
              py: 1.75,
              textTransform: "none",
              fontWeight: 600,
              fontSize: 16,
              borderRadius: 2,
              bgcolor: "#fff",
            }}
            onClick={() => goChoose("subscription")}
          >
            Choisir un abonnement
          </Button>
        </Stack>
      )}

      <Stack spacing={1} sx={{ mt: 2 }}>
        <Button
          fullWidth
          sx={{ textTransform: "none", color: "#64748b" }}
          onClick={() => router.push("/m/tarifs")}
        >
          Voir les tarifs
        </Button>
      </Stack>
    </Box>
  );
}

MobileHome.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileHome;
