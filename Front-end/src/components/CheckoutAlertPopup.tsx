import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { getAdminSocket } from "src/utils/adminSocket";

export type CheckoutEvent = {
  journalId: string;
  memberId: string | null;
  visitorNumber: number | null;
  visitLabel: string;
  memberPhone: string | null;
  priceName: string | null;
  payedAmount: number;
  isPayed: boolean;
  durationLabel: string;
  leaveTime: string;
};

/**
 * Popup when a mobile visitor checks out.
 */
export default function CheckoutAlertPopup() {
  const [event, setEvent] = useState<CheckoutEvent | null>(null);
  const [queue, setQueue] = useState<CheckoutEvent[]>([]);

  useEffect(() => {
    const s = getAdminSocket();
    const onCheckout = (data: CheckoutEvent) => {
      setQueue((q) => [...q, data]);
    };
    s.on("visitor_checkout", onCheckout);
    return () => {
      s.off("visitor_checkout", onCheckout);
    };
  }, []);

  useEffect(() => {
    if (!event && queue.length) {
      setEvent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [event, queue]);

  const handleClose = () => setEvent(null);

  return (
    <Dialog
      open={!!event}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle>Visitor checked out</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            bgcolor: "#f5f8fc",
            border: "1px solid #d6e4f5",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Typography fontWeight={700} fontSize={18}>
            {event?.visitLabel || "Visiteur"}
            {event?.visitorNumber != null ? (
              <Typography
                component="span"
                sx={{ ml: 1, color: "#1976d2", fontWeight: 800 }}
              >
                #{event.visitorNumber}
              </Typography>
            ) : null}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {event?.memberPhone || "—"}
          </Typography>
          <Typography>
            {event?.priceName || "Session"} · {event?.durationLabel}
          </Typography>
          <Typography fontWeight={700} color="primary.main" sx={{ mt: 1 }}>
            {event?.payedAmount} DT ·{" "}
            {event?.isPayed ? "Payé" : "Non payé"}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={handleClose} sx={{ bgcolor: "#1976d2" }}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
