import React, { useEffect, useRef, useState } from "react";
import styled from "@emotion/styled";
import {
  Avatar as MuiAvatar,
  Badge,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Popover as MuiPopover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Bell, UserPlus } from "react-feather";
import {
  useApproveVisitRequestMutation,
  useGetPendingVisitRequestsQuery,
  useRejectVisitRequestMutation,
} from "src/api/mobile.repo";
import { getAdminSocket } from "src/utils/adminSocket";

const Popover = styled(MuiPopover)`
  .MuiPaper-root {
    width: 360px;
    ${(props) => props.theme.shadows[1]};
    border: 1px solid ${(props) => props.theme.palette.divider};
  }
`;

const Indicator = styled(Badge)`
  .MuiBadge-badge {
    background: ${(props) => props.theme.header.indicator.background};
    color: ${(props) => props.theme.palette.common.white};
  }
`;

const Avatar = styled(MuiAvatar)`
  background: #0d47a1;
`;

const NotificationHeader = styled(Box)`
  text-align: center;
  border-bottom: 1px solid ${(props) => props.theme.palette.divider};
`;

function NavbarNotificationsDropdown() {
  const ref = useRef(null);
  const [isOpen, setOpen] = useState(false);
  const { data: pending = [], refetch } = useGetPendingVisitRequestsQuery(
    undefined,
    { pollingInterval: 8000 }
  );
  const [approve, { isLoading: approving }] = useApproveVisitRequestMutation();
  const [reject, { isLoading: rejecting }] = useRejectVisitRequestMutation();

  useEffect(() => {
    const s = getAdminSocket();
    const onRequest = () => refetch();
    const onResolved = () => refetch();
    s.on("visit_request", onRequest);
    s.on("visit_request_resolved", onResolved);
    return () => {
      s.off("visit_request", onRequest);
      s.off("visit_request_resolved", onResolved);
    };
  }, [refetch]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleApprove = async (id: string) => {
    await approve(id).unwrap();
    refetch();
  };

  const handleReject = async (id: string) => {
    await reject(id).unwrap();
    refetch();
  };

  const count = pending.length;

  return (
    <React.Fragment>
      <Tooltip title="Visit requests">
        <IconButton color="inherit" ref={ref} onClick={handleOpen} size="large">
          <Indicator badgeContent={count || undefined}>
            <Bell />
          </Indicator>
        </IconButton>
      </Tooltip>
      <Popover
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        anchorEl={ref.current}
        onClose={handleClose}
        open={isOpen}
      >
        <NotificationHeader p={2}>
          <Typography variant="subtitle1" color="textPrimary">
            {count
              ? `${count} pending visit request${count > 1 ? "s" : ""}`
              : "No pending requests"}
          </Typography>
        </NotificationHeader>
        <List disablePadding>
          {pending.map((req) => {
            const name =
              [req.member?.firstName, req.member?.lastName]
                .filter(Boolean)
                .join(" ") || "Visiteur";
            const phone = req.member?.phone || "";
            const pack = req.price?.name || "Pack";
            const amount = req.price?.price;
            return (
              <ListItem
                key={req.id}
                alignItems="flex-start"
                divider
                sx={{ flexDirection: "column", alignItems: "stretch", gap: 1 }}
              >
                <Box display="flex" gap={1.5} alignItems="center">
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar>
                      <UserPlus size={16} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${name}${req.member?.visitorNumber != null || req.visitorNumber != null ? ` #${req.member?.visitorNumber ?? req.visitorNumber}` : ""} · ${phone}`}
                    secondary={`${req.type === "DAY" ? "Visite du jour" : "Abonnement"} — ${pack}${amount != null ? ` (${amount} DT)` : ""}`}
                    primaryTypographyProps={{
                      variant: "subtitle2",
                      color: "textPrimary",
                    }}
                  />
                </Box>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    color="inherit"
                    disabled={rejecting || approving}
                    onClick={() => handleReject(req.id)}
                  >
                    Reject
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={approving || rejecting}
                    onClick={() => handleApprove(req.id)}
                    sx={{ bgcolor: "#0d47a1" }}
                  >
                    Confirm
                  </Button>
                </Stack>
              </ListItem>
            );
          })}
          {!pending.length ? (
            <Box p={2}>
              <Typography variant="body2" color="textSecondary">
                When a visitor picks a pack on mobile, it appears here for
                confirmation.
              </Typography>
            </Box>
          ) : null}
        </List>
      </Popover>
    </React.Fragment>
  );
}

export default NavbarNotificationsDropdown;
