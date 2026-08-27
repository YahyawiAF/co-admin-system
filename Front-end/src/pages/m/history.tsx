import { ReactElement, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { format } from "date-fns";
import MobileLayout from "src/layouts/MobileVisitor";
import { useGetVisitHistoryQuery } from "src/api/mobile.repo";

function MobileHistory() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    setMemberId(sessionStorage.getItem("memberId"));
  }, []);

  const { data: visits = [], isLoading, error } = useGetVisitHistoryQuery(
    memberId || "",
    { skip: !memberId }
  );

  if (!memberId) {
    return (
      <Alert severity="warning">
        Non connecté.{" "}
        <Button onClick={() => router.push("/m")}>Accueil</Button>
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
        Historique
      </Typography>
      <Typography variant="body2" sx={{ mb: 2.5, color: "#64748b" }}>
        Vos visites — durée et paiement.
      </Typography>

      {isLoading ? (
        <Typography color="text.secondary">Chargement…</Typography>
      ) : null}
      {error ? (
        <Alert severity="error">Impossible de charger l&apos;historique.</Alert>
      ) : null}

      {!isLoading && !visits.length ? (
        <Box
          sx={{
            bgcolor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 2,
            p: 3,
            textAlign: "center",
          }}
        >
          <Typography color="#64748b">Aucune visite pour le moment.</Typography>
        </Box>
      ) : null}

      <Stack spacing={1.25}>
        {visits.map((v) => (
          <Box
            key={v.id}
            sx={{
              bgcolor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 2,
              px: 2,
              py: 1.5,
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              spacing={1}
            >
              <Box>
                <Typography fontWeight={600}>
                  {format(new Date(v.date), "dd/MM/yyyy")}
                </Typography>
                <Typography variant="body2" color="#64748b">
                  {format(new Date(v.registredTime), "HH:mm")}
                  {v.leaveTime
                    ? ` → ${format(new Date(v.leaveTime), "HH:mm")}`
                    : " → en cours"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {v.priceName || "Visite"} · {v.durationLabel}
                </Typography>
              </Box>
              <Stack alignItems="flex-end" spacing={0.75}>
                <Chip
                  size="small"
                  label={
                    v.isOpen
                      ? "En cours"
                      : v.isPayed
                        ? "Payé"
                        : "Non payé"
                  }
                  color={
                    v.isOpen ? "info" : v.isPayed ? "success" : "warning"
                  }
                  sx={{ fontWeight: 600 }}
                />
                <Typography fontWeight={700} color="#1976d2">
                  {v.payedAmount} DT
                </Typography>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

MobileHistory.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileHistory;
