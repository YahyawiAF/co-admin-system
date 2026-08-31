import { Badge } from "@/components/ui/badge";

export function UnpaidDebtBadge({
  amount,
  label = "Crédit impayé",
}: {
  amount?: number | null;
  label?: string;
}) {
  if (amount == null || amount <= 0.009) return null;
  const shown =
    amount >= 10 ? amount.toFixed(0) : amount.toFixed(1).replace(/\.0$/, "");
  return (
    <Badge className="h-5 bg-rose-600 text-[10px] hover:bg-rose-600">
      {label} · {shown} DT
    </Badge>
  );
}
