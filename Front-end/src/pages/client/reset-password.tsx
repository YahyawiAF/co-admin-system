import React, { useState, useEffect } from "react";
import type { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import {
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useResetPasswordMutation } from "../../api/auth.repo"; // Mettez le bon chemin
import AuthLayout from "../../layouts/Auth";
import Logo from "../../vendor/logo.svg";
import { useRouter } from "next/router"; // Utilisez useRouter de Next.js
import { SerializedError } from "@reduxjs/toolkit"; // Importez SerializedError
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";

const Brand = styled(Logo)`
  fill: ${(props) => props.theme.palette.primary.main};
  width: 64px;
  height: 64px;
  margin-bottom: 32px;
`;

const Wrapper = styled(Paper)`
  padding: ${(props) => props.theme.spacing(6)};

  ${(props) => props.theme.breakpoints.up("md")} {
    padding: ${(props) => props.theme.spacing(10)};
  }
`;

const Form = styled.form`
  margin-top: ${(props) => props.theme.spacing(3)};
`;

function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPassword, { isLoading, isSuccess, error }] =
    useResetPasswordMutation();
  const router = useRouter(); // Utilisez useRouter pour accéder aux query parameters
  const { token } = router.query; // Récupérez le token depuis les query parameters

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifiez que le token est présent
    if (!token) {
      alert("Token manquant dans l'URL.");
      return;
    }

    // Vérifiez que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      // Appel de l'API avec le token dans le chemin et le nouveau mot de passe dans le corps
      await resetPassword({ token: token as string, newPassword }).unwrap();

      // Redirigez l'utilisateur vers la page de connexion après une réinitialisation réussie
      router.push("/client/login");
    } catch (err) {
      console.error(
        "Erreur lors de la réinitialisation du mot de passe :",
        err
      );
    }
  };

  // Fonction pour afficher le message d'erreur
  const getErrorMessage = (
    error: FetchBaseQueryError | SerializedError | undefined
  ): string => {
    if (error) {
      if ("status" in error) {
        // FetchBaseQueryError
        return `Erreur ${error.status}: ${JSON.stringify(error.data)}`;
      } else {
        // SerializedError
        return error.message || "Une erreur inconnue s'est produite.";
      }
    }
    return "";
  };

  // Si le token est manquant, affichez un message d'erreur
  if (!token) {
    return (
      <Wrapper>
        <Alert severity="error">Token manquant dans l'URL.</Alert>
      </Wrapper>
    );
  }

  return (
    <React.Fragment>
      <Brand />
      <Wrapper>
        <Helmet title="Reset Password" />

        <Typography component="h1" variant="h4" align="center" gutterBottom>
          Reset Password
        </Typography>
        <Typography component="h2" variant="body1" align="center">
          Enter your new password
        </Typography>

        <Form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            required
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            sx={{ marginTop: 2 }}
          >
            {isLoading ? <CircularProgress size={24} /> : "Reset Password"}
          </Button>
        </Form>

        {isSuccess && (
          <Alert severity="success" sx={{ marginTop: 2 }}>
            Votre mot de passe a été réinitialisé avec succès.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ marginTop: 2 }}>
            {getErrorMessage(error)}
          </Alert>
        )}
      </Wrapper>
    </React.Fragment>
  );
}

ResetPassword.getLayout = function getLayout(page: ReactElement) {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ResetPassword;
