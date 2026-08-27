import { FC, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useGetMembersQuery } from "src/api";
import { useGetPricesQuery } from "src/api/price.repo";
import { useQuickCheckInMutation } from "src/api/mobile.repo";
import { BillingUnit, Member, PriceCategory, PriceType } from "src/types/shared";

interface QuickCheckInPanelProps {
  onDone?: () => void;
  /** Member IDs already present today (open journal) — hidden from search */
  presentMemberIds?: string[];
}

const fieldSx = {
  bgcolor: "#fff",
  "& .MuiOutlinedInput-root": { bgcolor: "#fff" },
};

const QuickCheckInPanel: FC<QuickCheckInPanelProps> = ({
  onDone,
  presentMemberIds = [],
}) => {
  const { data: membersData, refetch: refetchMembers } = useGetMembersQuery();
  const { data: prices = [] } = useGetPricesQuery();
  const [quickCheckIn, { isLoading, error }] = useQuickCheckInMutation();
  const [successMsg, setSuccessMsg] = useState("");

  const presentSet = useMemo(
    () => new Set(presentMemberIds.filter(Boolean)),
    [presentMemberIds]
  );

  const availableMembers: Member[] = useMemo(() => {
    const list = Array.isArray(membersData)
      ? (membersData as Member[])
      : ((membersData as any)?.data as Member[]) || [];
    return list.filter((m) => !presentSet.has(m.id));
  }, [membersData, presentSet]);

  const journeePacks = useMemo(
    () =>
      prices.filter(
        (p) =>
          p.category === PriceCategory.JOURNEE ||
          (p.type === PriceType.journal &&
            (p.billingUnit === BillingUnit.PACK || !p.billingUnit))
      ),
    [prices]
  );

  const [member, setMember] = useState<Member | null>(null);
  const [priceId, setPriceId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");

  const resetForm = () => {
    setMember(null);
    setNewPhone("");
    setNewName("");
    setPriceId(journeePacks[0]?.id || "");
  };

  const handleSubmit = async () => {
    const pack = priceId || journeePacks[0]?.id;
    if (!pack) return;
    setSuccessMsg("");
    try {
      await quickCheckIn({
        priceId: pack,
        memberId: mode === "existing" ? member?.id : undefined,
        phone: mode === "new" ? newPhone : undefined,
        firstName: mode === "new" ? newName : undefined,
      }).unwrap();
      setSuccessMsg("Checked in");
      resetForm();
      refetchMembers();
      onDone?.();
    } catch {
      /* RTK error */
    }
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: "#f7fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="subtitle1" fontWeight={600} color="#1a202c">
          Quick check-in
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, v) => {
            if (!v) return;
            setMode(v);
            resetForm();
            setSuccessMsg("");
          }}
        >
          <ToggleButton value="existing" sx={{ textTransform: "none", px: 2 }}>
            Member
          </ToggleButton>
          <ToggleButton value="new" sx={{ textTransform: "none", px: 2 }}>
            New
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ md: "center" }}
      >
        {mode === "existing" ? (
          <Autocomplete
            sx={{ flex: 2, minWidth: 200 }}
            options={availableMembers}
            getOptionLabel={(m) =>
              `${
                m.fullName ||
                `${m.firstName || ""} ${m.lastName || ""}`.trim() ||
                "Member"
              }${m.visitorNumber != null ? ` #${m.visitorNumber}` : ""}${
                m.phone ? ` · ${m.phone}` : ""
              }`
            }
            value={member}
            onChange={(_, v) => setMember(v)}
            noOptionsText="No members available (already here or empty)"
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search member"
                size="small"
                sx={fieldSx}
              />
            )}
          />
        ) : (
          <>
            <TextField
              label="Name"
              size="small"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ ...fieldSx, flex: 1, minWidth: 120 }}
            />
            <TextField
              label="Phone"
              size="small"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="20123456"
              sx={{
                ...fieldSx,
                flex: 1,
                minWidth: 140,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#90caf9" },
                  "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                },
              }}
            />
          </>
        )}
        <TextField
          select
          size="small"
          label="Pack"
          value={priceId || journeePacks[0]?.id || ""}
          onChange={(e) => setPriceId(e.target.value)}
          sx={{ ...fieldSx, minWidth: 160, flex: 1 }}
        >
          {journeePacks.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name} · {p.price} DT
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          disableElevation
          disabled={
            isLoading ||
            !(priceId || journeePacks[0]?.id) ||
            (mode === "existing" ? !member : !newPhone)
          }
          onClick={handleSubmit}
          sx={{
            bgcolor: "#1976d2",
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            height: 40,
            whiteSpace: "nowrap",
          }}
        >
          Check in
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {(error as any)?.data?.message || "Check-in failed"}
        </Alert>
      ) : null}
      {successMsg ? (
        <Alert
          severity="success"
          sx={{ mt: 1.5 }}
          onClose={() => setSuccessMsg("")}
        >
          {successMsg}
        </Alert>
      ) : null}
    </Box>
  );
};

export default QuickCheckInPanel;
