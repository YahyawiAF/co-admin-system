import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import {
  useApproveVisitRequestMutation,
  useGetPendingVisitRequestsQuery,
  useRejectVisitRequestMutation,
  VisitRequest,
} from "src/api/mobile.repo";
import { getRealtimeSocket } from "src/utils/adminSocket";
import { useDispatch } from "react-redux";
import { journalServerApi } from "src/api/journal.repo";

/**
 * Full-screen style popup when a mobile visitor requests check-in / subscription.
 */
export default function VisitRequestPopup() {
  const dispatch = useDispatch();
  const { data: pending = [], refetch } = useGetPendingVisitRequestsQuery(
    undefined,
    { pollingInterval: 5000 }
  );
  const [approve, { isLoading: approving }] = useApproveVisitRequestMutation();
  const [reject, { isLoading: rejecting }] = useRejectVisitRequestMutation();
  const [current, setCurrent] = useState<VisitRequest | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    const s = getRealtimeSocket();
    const refresh = () => {
      refetch();
      dispatch(journalServerApi.util.invalidateTags(["journalApi"]));
    };
    s.on("visit_request", refresh);
    s.on("visit_request_resolved", refresh);
    s.on("table_updates", refresh);
    return () => {
      s.off("visit_request", refresh);
      s.off("visit_request_resolved", refresh);
      s.off("table_updates", refresh);
    };
  }, [refetch, dispatch]);

  // Keep dialog on the oldest pending request
  useEffect(() => {
    if (!pending.length) {
      setCurrent(null);
      setQueue([]);
      return;
    }
    const ids = pending.map((p) => p.id);
    setQueue(ids);
    setCurrent((prev) => {
      if (prev && ids.includes(prev.id)) {
        return pending.find((p) => p.id === prev.id) || pending[0];
      }
      return pending[0];
    });
  }, [pending]);

  const busy = approving || rejecting;

  const handleApprove = async () => {
    if (!current) return;
    await approve(current.id).unwrap();
    dispatch(journalServerApi.util.invalidateTags(["journalApi"]));
    refetch();
  };

  const handleReject = async () => {
    if (!current) return;
    await reject(current.id).unwrap();
    refetch();
  };

  const name =
    [current?.member?.firstName, current?.member?.lastName]
      .filter(Boolean)
      .join(" ") || "Visiteur";
  const phone = current?.member?.phone || "—";
  const pack =
    current?.price?.name ||
    (current as any)?.priceName ||
    "Pack";
  const amount =
    current?.price?.price ?? (current as any)?.priceAmount;
  const isSub = current?.type === "SUBSCRIPTION";

  return (
    <Dialog
      open={!!current}
      disableEscapeKeyDown
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, p: 0.5 },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        {isSub ? "Confirm subscription" : "Confirm day visit"}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A visitor is waiting on their phone. Confirm to start their session.
        </Typography>
        <Box
          sx={{
            bgcolor: "#f5f8fc",
            border: "1px solid #d6e4f5",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography fontWeight={700} fontSize={18}>
            {name}
            {current?.member?.visitorNumber != null ||
            (current as any)?.visitorNumber != null ? (
              <Typography
                component="span"
                sx={{ ml: 1, color: "#1976d2", fontWeight: 800 }}
              >
                #
                {current?.member?.visitorNumber ??
                  (current as any)?.visitorNumber}
              </Typography>
            ) : null}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            {phone}
          </Typography>
          <Stack direction="row" justifyContent="space-between">
            <Typography>{pack}</Typography>
            <Typography fontWeight={700} color="primary.main">
              {amount != null ? `${amount} DT` : ""}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {isSub ? "Abonnement" : "Visite du jour"}
            {queue.length > 1 ? ` · ${queue.length} in queue` : ""}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleReject} disabled={busy} color="inherit">
          Reject
        </Button>
        <Button
          onClick={handleApprove}
          disabled={busy}
          variant="contained"
          sx={{ bgcolor: "#1976d2", px: 3 }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
