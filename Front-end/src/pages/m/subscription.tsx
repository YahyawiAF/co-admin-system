import { ReactElement, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, Typography } from "@mui/material";
import { format } from "date-fns";
import MobileLayout from "src/layouts/MobileVisitor";
import { useGetMobileStatusQuery } from "src/api/mobile.repo";

function MobileSubscription() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  useEffect(() => {
    setMemberId(sessionStorage.getItem("memberId"));
  }, []);

  const { data, isLoading } = useGetMobileStatusQuery(memberId || "", {
    skip: !memberId,
  });

  if (!memberId) {
    return (
      <Alert severity="warning">
        Non connecté.{" "}
        <Button onClick={() => router.push("/m")}>Accueil</Button>
      </Alert>
    );
  }

  if (isLoading) return <Typography color="text.secondary">Chargement…</Typography>;

  const sub = data?.subscription;

  if (!sub) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          Pas d&apos;abonnement
        </Typography>
        <Typography sx={{ mb: 2, color: "#64748b" }}>
          Souscrivez pour un accès semaine, 2 semaines ou mois.
        </Typography>
        <Button
          variant="contained"
          disableElevation
          sx={{ bgcolor: "#1976d2", textTransform: "none", borderRadius: 2 }}
          onClick={() =>
            router.push({
              pathname: "/m/signup",
              query: { mode: "subscription" },
            })
          }
        >
          Souscrire
        </Button>
      </Box>
    );
  }

  const leave = sub.leaveDate ? new Date(sub.leaveDate) : null;
  const daysLeft = leave
    ? Math.max(
        0,
        Math.ceil((leave.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Abonnement actif
      </Typography>
      <Box
        sx={{
          bgcolor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 3,
          p: 2.5,
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          {(sub as any).price?.name || "Plan"}
        </Typography>
        <Typography color="#64748b" sx={{ mb: 2 }}>
          Du {format(new Date(sub.registredDate), "dd/MM/yyyy")}
          {leave ? ` au ${format(leave, "dd/MM/yyyy")}` : ""}
        </Typography>
        {daysLeft !== null ? (
          <Typography variant="h3" sx={{ color: "#1976d2", fontWeight: 700 }}>
            {daysLeft} j
          </Typography>
        ) : null}
        <Typography sx={{ mt: 1, color: "#64748b" }}>
          {sub.payedAmount} DT
        </Typography>
      </Box>
      <Alert severity="info">
        Pendant la validité, les check-ins journaliers peuvent être à 0 DT.
      </Alert>
    </Box>
  );
}

MobileSubscription.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileSubscription;
