import React, { useState } from "react";
import type { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { Avatar, Paper, Typography, TextField, Button, CircularProgress, Box, Link, Checkbox, FormControlLabel } from "@mui/material";
import { useLoginMutation } from "../../api/auth.repo"; // Importer le hook
import AuthLayout from "../../layouts/Auth";
import Logo from "../../vendor/logo.svg";
import Swal from "sweetalert2"; // Importer SweetAlert2

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

const BigAvatar = styled(Avatar)`
  width: 92px;
  height: 92px;
  text-align: center;
  margin: 0 auto ${(props) => props.theme.spacing(5)};
`;

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false); // État pour "Remember Me"
  const [login, { isLoading, isError, error }] = useLoginMutation(); // Utiliser le hook

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login({ email, password }).unwrap();
      // Si la connexion réussit, redirection via window.location
      Swal.fire({
        title: "Success!",
        text: "You have logged in successfully.",
        icon: "success",
        confirmButtonText: "OK"
      }).then(() => {
        window.location.href = "/"; // Rediriger vers le tableau de bord
      });
    } catch (err) {
      console.error("Login failed", err);
      Swal.fire({
        title: "Failed!",
        text: "An error occurred during login. Please try again.",
        icon: "error",
        confirmButtonText: "OK"
      });
    }
  };

  // Gérer le message d'erreur
  const getErrorMessage = () => {
    if (isError && error) {
      if (error && 'data' in error && typeof error.data === 'string') {
        return error.data;
      }
      if (error && 'message' in error) {
        return error.message;
      }
    }
    return "An error occurred during login.";
  };

  return (
    <React.Fragment>
      <Brand />
      <Wrapper>
        <Helmet title="Sign In" />
        <BigAvatar alt="User" src="/static/img/avatars/avatar-1.jpg" />

        <Typography component="h1" variant="h4" align="center" gutterBottom>
          Welcome back, Lucy!
        </Typography>
        <Typography component="h2" variant="body1" align="center">
          Sign in to your account to continue
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          {/* Checkbox Remember Me */}
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                color="primary"
              />
            }
            label="Remember Me"
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : "Sign In"}
          </Button>

          {isError && (
            <Box mt={2} color="error.main" textAlign="center">
              <Typography variant="body2">{getErrorMessage()}</Typography>
            </Box>
          )}
        </form>
        
        {/* Lien Forgot Password */}
        <Box mt={2} textAlign="center">
          <Link href="/auth/reset-password/" variant="body2">
            Forgot Password?
          </Link>
        </Box>

        {/* Nouveau lien Sign In */}
        <Box mt={2} textAlign="center">
          <Link href="/auth/sign-up" variant="body2">
           Don't have an account? Sign Up
          </Link>
        </Box>
      </Wrapper>
    </React.Fragment>
  );
}

SignIn.getLayout = function getLayout(page: ReactElement) {
  return <AuthLayout>{page}</AuthLayout>;
};

export default SignIn;
