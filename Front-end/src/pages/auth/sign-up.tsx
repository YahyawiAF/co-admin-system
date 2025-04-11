import React, { useState } from "react";
import { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { Paper, Typography, Button, TextField, CircularProgress, Box, Link } from "@mui/material";
import Swal from "sweetalert2";

import AuthLayout from "../../layouts/Auth";
import { useSignUpMutation } from "../../api/auth.repo";

import Logo from "../../vendor/logo.svg";
import { Role } from "src/types/shared";

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

function SignUp() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullname, setFullname] = useState("");
  const [isPhone, setIsPhone] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [signUp, { isLoading, isError, error }] = useSignUpMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      await signUp({ identifier, password, fullname,role: Role.ADMIN }).unwrap();      
      Swal.fire({
        title: "Success!",
        text: "You have successfully signed up.",
        icon: "success",
        confirmButtonText: "Go to Sign In",
      }).then(() => {
        window.location.href = "/auth/sign-in";
      });
    } catch (err) {
      console.error("Signup error:", err);

      Swal.fire({
        title: "Failed!",
        text: getErrorMessage(),
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const getErrorMessage = () => {
    if (isError && error) {
      if ('data' in error && typeof error.data === 'string') {
        return error.data;
      }
      if ('message' in error) {
        return error.message;
      }
    }
    return "An error occurred during sign up.";
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIdentifier(value);
    // Détecter si c'est un email ou un numéro de téléphone
    setIsPhone(!value.includes('@') && /[0-9]/.test(value));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Effacer l'erreur lorsque l'utilisateur modifie le mot de passe
    if (passwordError && e.target.value === confirmPassword) {
      setPasswordError("");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    // Effacer l'erreur lorsque l'utilisateur modifie la confirmation
    if (passwordError && e.target.value === password) {
      setPasswordError("");
    }
  };

  return (
    <React.Fragment>
      <Brand />
      <Wrapper>
        <Helmet title="Sign Up" />
        <Typography component="h1" variant="h4" align="center" gutterBottom>
          Get started
        </Typography>
        <Typography component="h2" variant="body1" align="center">
          Start creating the best possible user experience for your customers
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Full Name"
            variant="outlined"
            fullWidth
            margin="normal"
            value={fullname}
            onChange={(e) => setFullname(e.target.value)}
            required
          />
          <TextField
            label={isPhone ? "Phone Number " : "Email or Phone Number"}
            variant="outlined"
            fullWidth
            margin="normal"
            value={identifier}
            onChange={handleIdentifierChange}
            required
            type={isPhone ? "tel" : "text"}
          />
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            required
          />
          <TextField
            label="Confirm Password"
            variant="outlined"
            fullWidth
            margin="normal"
            type="password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            required
            error={!!passwordError}
            helperText={passwordError}
          />
          

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : "Sign Up"}
          </Button>
          <Box mt={2} textAlign="center">
                    <Link href="/auth/sign-in" variant="body2">
                     Already have account? Sign In
                    </Link>
                  </Box>
          {isError && (
            <Typography color="error" align="center" mt={2}>
              {getErrorMessage()}
            </Typography>
          )}
        </form>
      </Wrapper>
    </React.Fragment>
  );
}

SignUp.getLayout = function getLayout(page: ReactElement) {
  return <AuthLayout>{page}</AuthLayout>;
};

export default SignUp;