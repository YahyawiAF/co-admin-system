import { ReactElement, useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import MobileLayout from "src/layouts/MobileVisitor";
import { useGetMobileTarifsQuery } from "src/api/mobile.repo";
import { BillingUnit, Price, PriceCategory } from "src/types/shared";

const SECTIONS: { key: PriceCategory; title: string; tip: string }[] = [
  {
    key: PriceCategory.JOURNEE,
    title: "Journée",
    tip: "Forfait fixe (2h, 4h, 6h, 12h). Le prix affiché est celui du pack.",
  },
  {
    key: PriceCategory.ABONNEMENT,
    title: "Abonnement",
    tip: "Semaine, 2 semaines ou 1 mois — demi-journée ou journée.",
  },
  {
    key: PriceCategory.SALLE,
    title: "Salle de réunion",
    tip: "Horaire (arrondi à l'heure) ou forfait journée.",
  },
  {
    key: PriceCategory.OPEN_SPACE,
    title: "Open space",
    tip: "Horaire ou forfait journée.",
  },
];

function group(prices: Price[], category: PriceCategory) {
  return prices.filter((p) => p.category === category);
}

function MobileTarifs() {
  const { data: prices = [], isLoading } = useGetMobileTarifsQuery();

  const bySection = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        items: group(prices, s.key),
      })),
    [prices]
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
        Tarifs
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#64748b" }}>
        Collabora Hub — comment les prix sont calculés.
      </Typography>
      {isLoading ? (
        <Typography color="text.secondary">Chargement…</Typography>
      ) : (
        <Stack spacing={2.5}>
          {bySection.map((section) => (
            <Box key={section.title}>
              <Typography
                fontWeight={700}
                sx={{
                  bgcolor: "#1976d2",
                  color: "#fff",
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  mb: 1,
                  display: "inline-block",
                }}
              >
                {section.title}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: "#64748b" }}
              >
                {section.tip}
              </Typography>
              <Stack spacing={0.75}>
                {section.items.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      bgcolor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 1.5,
                      px: 1.5,
                      py: 1.25,
                    }}
                  >
                    <Typography variant="body2">{item.name}</Typography>
                    <Typography variant="body2" fontWeight={700} color="#1976d2">
                      {item.price}
                      {item.billingUnit === BillingUnit.HOURLY ? " DT/h" : " DT"}
                    </Typography>
                  </Box>
                ))}
                {!section.items.length ? (
                  <Typography variant="body2" color="#94a3b8">
                    Tarifs non chargés.
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

MobileTarifs.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileTarifs;
