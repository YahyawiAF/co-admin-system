import { ReactElement, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MobileLayout from "src/layouts/MobileVisitor";
import { useMobileRegisterMutation } from "src/api/mobile.repo";
import { loadVisitorCache, saveVisitorCache } from "src/utils/visitorCache";

const fieldSx = {
  bgcolor: "#fff",
  borderRadius: 1,
  "& .MuiOutlinedInput-root": {
    bgcolor: "#fff",
    borderRadius: 2,
  },
};

function MobileSignup() {
  const router = useRouter();
  const mode = (router.query.mode as string) || "day";
  const requirePassword = mode === "subscription";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [register, { isLoading, error }] = useMobileRegisterMutation();

  useEffect(() => {
    const cached = loadVisitorCache();
    if (cached?.phone) setPhone(cached.phone);
    // Returning visitor: keep same identity when upgrading to subscription
    if (requirePassword && cached?.firstName && !cached.firstName.startsWith("Visite ")) {
      setFirstName(cached.firstName);
    }
  }, [requirePassword]);

  const submit = async () => {
    const res = await register({
      phone,
      password: password || undefined,
      firstName: firstName || undefined,
      requirePassword,
    }).unwrap();
    saveVisitorCache(res.member, res.accessToken);
    router.push({ pathname: "/m/choose", query: { mode } });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700, color: "#0f172a" }}>
        {requirePassword ? "Abonnement" : "Visite du jour"}
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#64748b" }}>
        {requirePassword
          ? "Téléphone et mot de passe obligatoires. Votre numéro visiteur reste le même."
          : "Téléphone obligatoire. Votre profil est enregistré sur cet appareil."}
      </Typography>
      <Stack spacing={2}>
        {requirePassword ? (
          <TextField
            label="Prénom (optionnel)"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            fullWidth
            sx={fieldSx}
          />
        ) : null}
        <TextField
          label="Téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          fullWidth
          required
          placeholder="ex: 20123456"
          sx={fieldSx}
        />
        <TextField
          label={requirePassword ? "Mot de passe" : "Mot de passe (optionnel)"}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          required={requirePassword}
          sx={fieldSx}
        />
        {error ? (
          <Alert severity="error">
            {(error as any)?.data?.message || "Erreur d'inscription"}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          disableElevation
          disabled={isLoading || !phone || (requirePassword && !password)}
          onClick={submit}
          sx={{
            bgcolor: "#1976d2",
            py: 1.5,
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Continuer
        </Button>
      </Stack>
    </Box>
  );
}

MobileSignup.getLayout = (page: ReactElement) => (
  <MobileLayout>{page}</MobileLayout>
);

export default MobileSignup;
