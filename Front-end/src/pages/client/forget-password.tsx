import React, { useState } from "react";
import type { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { Paper, Typography, TextField, Button, CircularProgress, Alert } from "@mui/material";
import { useForgotPasswordMutation } from "../../api/auth.repo"; // Mettez le bon chemin
import AuthLayout from "../../layouts/Auth";
import Logo from "../../vendor/logo.svg";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query"; // Importez FetchBaseQueryError
import { SerializedError } from "@reduxjs/toolkit"; // Importez SerializedError

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

function ForgetPassword() {
  const [email, setEmail] = useState("");
  const [forgotPassword, { isLoading, isSuccess, error }] = useForgotPasswordMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword({ email }).unwrap();
    } catch (err) {
      console.error("Erreur lors de la demande de réinitialisation :", err);
    }
  };

  // Fonction pour afficher le message d'erreur
  const getErrorMessage = (error: FetchBaseQueryError | SerializedError | undefined): string => {
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

  return (
    <React.Fragment>
      <Brand />
      <Wrapper>
        <Helmet title="Forget Password" />

        <Typography component="h1" variant="h4" align="center" gutterBottom>
          Forget Password
        </Typography>
        <Typography component="h2" variant="body1" align="center">
          Enter your email to reset your password
        </Typography>

        <Form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {isLoading ? <CircularProgress size={24} /> : "Send Reset Link"}
          </Button>
        </Form>

        {isSuccess && (
          <Alert severity="success" sx={{ marginTop: 2 }}>
            Un e-mail de réinitialisation a été envoyé.
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

ForgetPassword.getLayout = function getLayout(page: ReactElement) {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ForgetPassword;