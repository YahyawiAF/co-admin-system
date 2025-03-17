import React, { useState } from "react";
import { ReactElement } from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";
import { Paper, Typography, Button, TextField, CircularProgress } from "@mui/material";
import Swal from "sweetalert2"; // Import SweetAlert2

import AuthLayout from "../../layouts/Auth";
import { useSignUpMutation } from "../../api/auth.repo";  // Import the mutation

import Logo from "../../vendor/logo.svg";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState("");

  const [signUp, { isLoading, isError, error }] = useSignUpMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await signUp({ email, password, fullname }).unwrap();
      
      // Show SweetAlert on successful sign-up
      Swal.fire({
        title: "Success!",
        text: "You have successfully signed up.",
        icon: "success",
        confirmButtonText: "Go to Sign In",
      }).then(() => {
        // Use window.location to redirect to the sign-in page
        window.location.href = "/auth/sign-in";  // Redirection sans `useNavigate`
      });
    } catch (err) {
      console.error("Signup error:", err);

      // Show SweetAlert on failed sign-up
      Swal.fire({
        title: "Failed!",
        text: "An error occurred during sign up. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  // Determine the error message based on the error type
  const getErrorMessage = () => {
    if (isError && error) {
      if (error && 'data' in error && typeof error.data === 'string') {
        return error.data; // Backend error message
      }
      if (error && 'message' in error) {
        return error.message; // Generic error message
      }
    }

    return "An error occurred during sign up.";
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

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : "Sign Up"}
          </Button>

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
